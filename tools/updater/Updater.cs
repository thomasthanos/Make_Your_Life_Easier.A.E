using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MyleUpdater
{
    sealed class Options
    {
        public int Pid;
        public string AppDir;
        public string ExeName;
        public string Url;
        public string Sha512;
        public string Version;
        public string UserData;

        public static Options Parse(string[] args)
        {
            var o = new Options();
            for (int i = 0; i + 1 < args.Length; i += 2)
            {
                var value = args[i + 1];
                switch (args[i])
                {
                    case "--pid": o.Pid = int.Parse(value); break;
                    case "--app-dir": o.AppDir = Path.GetFullPath(value); break;
                    case "--exe": o.ExeName = value; break;
                    case "--url": o.Url = value; break;
                    case "--sha512": o.Sha512 = value.Trim(); break;
                    case "--version": o.Version = value; break;
                    case "--user-data": o.UserData = Path.GetFullPath(value); break;
                }
            }
            if (o.Pid <= 0 || string.IsNullOrEmpty(o.AppDir) || string.IsNullOrEmpty(o.ExeName) ||
                string.IsNullOrEmpty(o.Url) || string.IsNullOrEmpty(o.Sha512) ||
                string.IsNullOrEmpty(o.Version) || string.IsNullOrEmpty(o.UserData))
            {
                throw new ArgumentException("Usage: Updater.exe --pid <n> --app-dir <path> --exe <name> --url <url> --sha512 <base64> --version <x.y.z> --user-data <path>");
            }
            return o;
        }
    }

    sealed class UpdateException : Exception
    {
        public readonly int Code;
        public UpdateException(int code, string message) : base(message) { Code = code; }
        public UpdateException(int code, string message, Exception inner) : base(message, inner) { Code = code; }
    }

    static class Log
    {
        static readonly object Gate = new object();
        static string _path;

        public static void Init(string userData)
        {
            try
            {
                var dir = Path.Combine(userData, "logs");
                Directory.CreateDirectory(dir);
                _path = Path.Combine(dir, "updater.log");
            }
            catch { }
        }

        public static void Write(string message)
        {
            if (_path == null) return;
            lock (Gate)
            {
                try { File.AppendAllText(_path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " " + message + Environment.NewLine); }
                catch { }
            }
        }
    }

    static class FileOps
    {
        public static void RetryMove(string source, string destination, int attempts)
        {
            for (int i = 1; ; i++)
            {
                try
                {
                    Directory.Move(source, destination);
                    return;
                }
                catch (Exception ex)
                {
                    if (i >= attempts) throw;
                    Log.Write("move retry " + i + "/" + attempts + " (" + source + " -> " + destination + "): " + ex.Message);
                    Thread.Sleep(Math.Min(500 * i, 5000));
                }
            }
        }

        public static bool TryDeleteDir(string path, int attempts)
        {
            if (!Directory.Exists(path)) return true;
            for (int i = 1; i <= attempts; i++)
            {
                try
                {
                    ClearAttributes(path);
                    Directory.Delete(path, true);
                    return true;
                }
                catch (Exception ex)
                {
                    Log.Write("delete retry " + i + "/" + attempts + " (" + path + "): " + ex.Message);
                    Thread.Sleep(1000);
                }
            }
            return !Directory.Exists(path);
        }

        public static void TryDeleteFile(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); }
            catch (Exception ex) { Log.Write("delete file failed (" + path + "): " + ex.Message); }
        }

        static void ClearAttributes(string path)
        {
            try
            {
                foreach (var file in Directory.GetFiles(path, "*", SearchOption.AllDirectories))
                {
                    try { File.SetAttributes(file, FileAttributes.Normal); } catch { }
                }
            }
            catch { }
        }
    }

    sealed class UpdaterForm : Form
    {
        readonly Options _opts;
        readonly Label _status;
        readonly Label _detail;
        readonly ProgressBar _bar;
        public int ExitCode;

        public UpdaterForm(Options opts)
        {
            _opts = opts;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            TopMost = true;
            ShowInTaskbar = true;
            ClientSize = new Size(400, 148);
            BackColor = Color.FromArgb(23, 23, 23);
            Text = "Make Your Life Easier - Updater";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            var title = new Label
            {
                Text = "Make Your Life Easier",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Bounds = new Rectangle(0, 18, 400, 28)
            };

            _status = new Label
            {
                Text = "Preparing update...",
                ForeColor = Color.FromArgb(190, 190, 190),
                Font = new Font("Segoe UI", 9.5f),
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Bounds = new Rectangle(0, 52, 400, 22)
            };

            _bar = new ProgressBar
            {
                Bounds = new Rectangle(40, 86, 320, 8),
                Style = ProgressBarStyle.Marquee,
                MarqueeAnimationSpeed = 25,
                Minimum = 0,
                Maximum = 100
            };

            _detail = new Label
            {
                Text = "v" + opts.Version,
                ForeColor = Color.FromArgb(120, 120, 120),
                Font = new Font("Segoe UI", 8.5f),
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Bounds = new Rectangle(0, 108, 400, 20)
            };

            Controls.Add(title);
            Controls.Add(_status);
            Controls.Add(_bar);
            Controls.Add(_detail);

            Shown += (s, e) =>
            {
                var worker = new Thread(Run) { IsBackground = true };
                worker.Start();
            };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var pen = new Pen(Color.FromArgb(60, 60, 60)))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
            }
        }

        void SetStatus(string text, Color? color = null)
        {
            BeginInvoke((Action)(() =>
            {
                _status.Text = text;
                _status.ForeColor = color ?? Color.FromArgb(190, 190, 190);
            }));
        }

        void SetDetail(string text)
        {
            BeginInvoke((Action)(() => { _detail.Text = text; }));
        }

        void SetMarquee()
        {
            BeginInvoke((Action)(() =>
            {
                _bar.Style = ProgressBarStyle.Marquee;
                _bar.MarqueeAnimationSpeed = 25;
            }));
        }

        void SetProgress(int percent)
        {
            BeginInvoke((Action)(() =>
            {
                if (_bar.Style != ProgressBarStyle.Continuous) _bar.Style = ProgressBarStyle.Continuous;
                _bar.Value = Math.Max(0, Math.Min(100, percent));
            }));
        }

        void Run()
        {
            var appDir = _opts.AppDir.TrimEnd('\\');
            var stagingDir = appDir + ".staging";
            var backupDir = appDir + ".backup";
            var selfDir = Path.GetDirectoryName(Path.GetFullPath(Application.ExecutablePath));
            var downloadDir = Path.Combine(selfDir, "download");
            var zipPath = Path.Combine(downloadDir, "update-" + _opts.Version + ".zip");
            var appExePath = Path.Combine(appDir, _opts.ExeName);
            bool installIntact = true;

            try
            {
                Log.Write("=== updater start v" + _opts.Version + " pid=" + _opts.Pid + " appDir=" + appDir);

                CleanupLeftovers(stagingDir, backupDir, selfDir);

                SetStatus("Waiting for application to close...");
                WaitForAppExit(appDir);

                SetStatus("Downloading update...");
                DownloadWithRetry(zipPath, downloadDir);

                SetStatus("Verifying download...");
                SetMarquee();
                if (!VerifySha512(zipPath, _opts.Sha512))
                {
                    Log.Write("sha512 mismatch, retrying full download");
                    FileOps.TryDeleteFile(zipPath);
                    SetStatus("Verification failed. Retrying download...");
                    DownloadWithRetry(zipPath, downloadDir);
                    SetStatus("Verifying download...");
                    SetMarquee();
                    if (!VerifySha512(zipPath, _opts.Sha512))
                    {
                        FileOps.TryDeleteFile(zipPath);
                        throw new UpdateException(4, "Checksum verification failed twice");
                    }
                }
                Log.Write("sha512 verified");

                SetStatus("Extracting files...");
                ExtractToStaging(zipPath, stagingDir);

                PreserveFiles(appDir, stagingDir);

                SetStatus("Installing update...");
                try
                {
                    FileOps.RetryMove(appDir, backupDir, 10);
                }
                catch (Exception ex)
                {
                    FileOps.TryDeleteDir(stagingDir, 3);
                    throw new UpdateException(6, "Could not move current installation aside: " + ex.Message, ex);
                }

                installIntact = false;
                try
                {
                    FileOps.RetryMove(stagingDir, appDir, 10);
                    installIntact = true;
                }
                catch (Exception ex)
                {
                    Log.Write("swap failed, rolling back: " + ex.Message);
                    SetStatus("Restoring previous version...", Color.FromArgb(230, 160, 60));
                    try
                    {
                        FileOps.RetryMove(backupDir, appDir, 10);
                        installIntact = true;
                        FileOps.TryDeleteDir(stagingDir, 3);
                        throw new UpdateException(6, "Update failed, previous version restored: " + ex.Message, ex);
                    }
                    catch (UpdateException) { throw; }
                    catch (Exception rollbackEx)
                    {
                        throw new UpdateException(7, "Update failed and rollback failed: " + rollbackEx.Message, rollbackEx);
                    }
                }

                Log.Write("swap complete");
                WriteJustUpdatedFlag();
                FileOps.TryDeleteFile(Path.Combine(_opts.UserData, ".update-failed"));
                UpdateUninstallRegistry();

                SetStatus("Starting application...");
                bool relaunched = Relaunch(appExePath, appDir);

                SetStatus("Cleaning up...");
                FileOps.TryDeleteDir(backupDir, 5);
                FileOps.TryDeleteFile(zipPath);

                Log.Write("update finished successfully");
                ExitCode = relaunched ? 0 : 8;
            }
            catch (UpdateException ex)
            {
                Fail(ex.Code, ex.Message, installIntact, appExePath, appDir, zipPath);
            }
            catch (Exception ex)
            {
                Fail(9, ex.ToString(), installIntact, appExePath, appDir, zipPath);
            }
            finally
            {
                BeginInvoke((Action)Close);
            }
        }

        void Fail(int code, string message, bool installIntact, string appExePath, string appDir, string zipPath)
        {
            Log.Write("FAILED (exit " + code + "): " + message);
            ExitCode = code;
            FileOps.TryDeleteFile(zipPath);
            FileOps.TryDeleteFile(Path.Combine(_opts.UserData, "update-info.json"));
            try { File.WriteAllText(Path.Combine(_opts.UserData, ".update-failed"), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString()); }
            catch { }

            if (code == 7)
            {
                SetStatus("Update failed", Color.FromArgb(220, 80, 80));
                MessageBox.Show(
                    "The update failed and the previous version could not be restored.\nPlease reinstall the application from:\nhttps://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest",
                    "Make Your Life Easier - Update Failed",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            SetStatus("Update failed. Restarting application...", Color.FromArgb(220, 80, 80));
            Thread.Sleep(4000);
            if (installIntact && File.Exists(appExePath))
            {
                Relaunch(appExePath, appDir);
            }
        }

        void CleanupLeftovers(string stagingDir, string backupDir, string selfDir)
        {
            FileOps.TryDeleteDir(stagingDir, 3);
            FileOps.TryDeleteDir(backupDir, 3);
            try
            {
                var self = Path.GetFullPath(Application.ExecutablePath);
                foreach (var file in Directory.GetFiles(selfDir, "Updater-*.exe"))
                {
                    if (!string.Equals(Path.GetFullPath(file), self, StringComparison.OrdinalIgnoreCase))
                    {
                        FileOps.TryDeleteFile(file);
                    }
                }
            }
            catch { }
        }

        void WaitForAppExit(string appDir)
        {
            try
            {
                var proc = Process.GetProcessById(_opts.Pid);
                if (!proc.WaitForExit(30000))
                {
                    Log.Write("app still running after 30s, killing pid " + _opts.Pid);
                    try
                    {
                        var kill = Process.Start(new ProcessStartInfo
                        {
                            FileName = "taskkill",
                            Arguments = "/PID " + _opts.Pid + " /T /F",
                            CreateNoWindow = true,
                            UseShellExecute = false
                        });
                        kill.WaitForExit(10000);
                    }
                    catch (Exception ex) { Log.Write("taskkill failed: " + ex.Message); }

                    if (!proc.WaitForExit(10000))
                    {
                        throw new UpdateException(2, "Application process did not exit");
                    }
                }
            }
            catch (ArgumentException) { }

            var deadline = DateTime.UtcNow.AddSeconds(10);
            var prefix = appDir.TrimEnd('\\') + "\\";
            while (DateTime.UtcNow < deadline)
            {
                if (!AnyProcessUnder(prefix)) break;
                Thread.Sleep(500);
            }
            Log.Write("app processes exited");
        }

        static bool AnyProcessUnder(string prefix)
        {
            foreach (var p in Process.GetProcesses())
            {
                try
                {
                    var path = p.MainModule.FileName;
                    if (path != null && path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
                }
                catch { }
                finally { p.Dispose(); }
            }
            return false;
        }

        void DownloadWithRetry(string zipPath, string downloadDir)
        {
            Directory.CreateDirectory(downloadDir);
            var delays = new[] { 2000, 5000, 10000 };
            for (int attempt = 0; ; attempt++)
            {
                try
                {
                    DownloadOnce(zipPath);
                    return;
                }
                catch (UpdateException) { throw; }
                catch (Exception ex)
                {
                    FileOps.TryDeleteFile(zipPath);
                    Log.Write("download attempt " + (attempt + 1) + " failed: " + ex.Message);
                    if (attempt >= delays.Length - 1)
                    {
                        throw new UpdateException(3, "Download failed after " + delays.Length + " attempts: " + ex.Message, ex);
                    }
                    SetStatus("Connection lost. Retrying (" + (attempt + 2) + "/" + delays.Length + ")...");
                    SetMarquee();
                    Thread.Sleep(delays[attempt]);
                }
            }
        }

        void DownloadOnce(string zipPath)
        {
            var request = (HttpWebRequest)WebRequest.Create(_opts.Url);
            request.Method = "GET";
            request.Timeout = 30000;
            request.ReadWriteTimeout = 30000;
            request.Headers["Cache-Control"] = "no-cache";

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                long total = response.ContentLength;
                if (total > 0)
                {
                    var drive = new DriveInfo(Path.GetPathRoot(zipPath));
                    if (drive.AvailableFreeSpace < total * 3)
                    {
                        throw new UpdateException(3, "Not enough free disk space (need " + FormatMb(total * 3) + " MB)");
                    }
                }

                var sw = Stopwatch.StartNew();
                long received = 0;
                long lastUiUpdate = 0;
                var buffer = new byte[81920];

                using (var stream = response.GetResponseStream())
                using (var file = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    int read;
                    while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        file.Write(buffer, 0, read);
                        received += read;

                        if (sw.ElapsedMilliseconds - lastUiUpdate >= 150)
                        {
                            lastUiUpdate = sw.ElapsedMilliseconds;
                            double speed = received / Math.Max(0.001, sw.Elapsed.TotalSeconds);
                            if (total > 0)
                            {
                                int percent = (int)(received * 100 / total);
                                SetProgress(percent);
                                SetStatus("Downloading update... " + percent + "%");
                                SetDetail(FormatMb(received) + " / " + FormatMb(total) + " MB  •  " + FormatMb((long)speed) + " MB/s");
                            }
                            else
                            {
                                SetStatus("Downloading update...");
                                SetDetail(FormatMb(received) + " MB  •  " + FormatMb((long)speed) + " MB/s");
                            }
                        }
                    }
                }

                if (total > 0 && received != total)
                {
                    throw new IOException("Incomplete download: " + received + "/" + total + " bytes");
                }
                Log.Write("downloaded " + received + " bytes");
                SetProgress(100);
                SetDetail("v" + _opts.Version);
            }
        }

        static string FormatMb(long bytes)
        {
            return (bytes / 1048576.0).ToString("0.0");
        }

        static bool VerifySha512(string filePath, string expectedBase64)
        {
            using (var sha = SHA512.Create())
            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 1048576))
            {
                var hash = sha.ComputeHash(stream);
                var computed = Convert.ToBase64String(hash);
                return string.Equals(computed, expectedBase64, StringComparison.Ordinal);
            }
        }

        void ExtractToStaging(string zipPath, string stagingDir)
        {
            try
            {
                FileOps.TryDeleteDir(stagingDir, 3);
                Directory.CreateDirectory(stagingDir);
                var root = Path.GetFullPath(stagingDir).TrimEnd('\\') + "\\";

                using (var archive = ZipFile.OpenRead(zipPath))
                {
                    int count = 0;
                    foreach (var entry in archive.Entries)
                    {
                        var destination = Path.GetFullPath(Path.Combine(stagingDir, entry.FullName));
                        if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                        {
                            throw new IOException("Zip entry escapes staging dir: " + entry.FullName);
                        }
                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(destination);
                            continue;
                        }
                        Directory.CreateDirectory(Path.GetDirectoryName(destination));
                        entry.ExtractToFile(destination, true);
                        count++;
                    }
                    Log.Write("extracted " + count + " files to staging");
                }

                if (!File.Exists(Path.Combine(stagingDir, _opts.ExeName)) ||
                    !Directory.Exists(Path.Combine(stagingDir, "resources")))
                {
                    throw new IOException("Staging sanity check failed: missing " + _opts.ExeName + " or resources dir");
                }
            }
            catch (Exception ex)
            {
                FileOps.TryDeleteDir(stagingDir, 3);
                throw new UpdateException(5, "Extraction failed: " + ex.Message, ex);
            }
        }

        void PreserveFiles(string appDir, string stagingDir)
        {
            var preserve = new[] { "Uninstall MakeYourLifeEasier.exe", "resources\\app-update.yml" };
            foreach (var relative in preserve)
            {
                try
                {
                    var source = Path.Combine(appDir, relative);
                    var destination = Path.Combine(stagingDir, relative);
                    if (File.Exists(source) && !File.Exists(destination))
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(destination));
                        File.Copy(source, destination);
                        Log.Write("preserved " + relative);
                    }
                }
                catch (Exception ex) { Log.Write("preserve failed (" + relative + "): " + ex.Message); }
            }
        }

        void WriteJustUpdatedFlag()
        {
            try
            {
                File.WriteAllText(Path.Combine(_opts.UserData, ".just-updated"), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());
                Log.Write("wrote .just-updated flag");
            }
            catch (Exception ex) { Log.Write("failed to write .just-updated: " + ex.Message); }
        }

        void UpdateUninstallRegistry()
        {
            try
            {
                using (var root = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true))
                {
                    if (root == null) return;
                    foreach (var name in root.GetSubKeyNames())
                    {
                        using (var key = root.OpenSubKey(name, true))
                        {
                            if (key == null) continue;
                            var displayName = key.GetValue("DisplayName") as string;
                            bool match = string.Equals(name, "MakeYourLifeEasier", StringComparison.OrdinalIgnoreCase) ||
                                (displayName != null && displayName.StartsWith("Make Your Life Easier", StringComparison.OrdinalIgnoreCase));
                            if (!match) continue;
                            key.SetValue("DisplayVersion", _opts.Version);
                            if (displayName != null)
                            {
                                key.SetValue("DisplayName", "Make Your Life Easier " + _opts.Version);
                            }
                            Log.Write("updated uninstall registry key: " + name);
                        }
                    }
                }
            }
            catch (Exception ex) { Log.Write("registry update failed: " + ex.Message); }
        }

        bool Relaunch(string appExePath, string appDir)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = appExePath,
                    WorkingDirectory = appDir,
                    UseShellExecute = true
                });
                Log.Write("relaunched " + appExePath);
                return true;
            }
            catch (Exception ex)
            {
                Log.Write("relaunch failed: " + ex.Message);
                return false;
            }
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            try { Directory.SetCurrentDirectory(Path.GetTempPath()); } catch { }

            Options opts;
            try
            {
                opts = Options.Parse(args);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Make Your Life Easier - Updater", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            Log.Init(opts.UserData);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            var form = new UpdaterForm(opts);
            Application.Run(form);
            Log.Write("=== updater exit " + form.ExitCode);
            return form.ExitCode;
        }
    }
}
