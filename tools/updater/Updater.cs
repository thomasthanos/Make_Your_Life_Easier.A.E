using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
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
        public string StagingDir;
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
                    case "--staging": o.StagingDir = Path.GetFullPath(value); break;
                    case "--version": o.Version = value; break;
                    case "--user-data": o.UserData = Path.GetFullPath(value); break;
                }
            }
            if (o.Pid <= 0 || string.IsNullOrEmpty(o.AppDir) || string.IsNullOrEmpty(o.ExeName) ||
                string.IsNullOrEmpty(o.StagingDir) || string.IsNullOrEmpty(o.Version) ||
                string.IsNullOrEmpty(o.UserData))
            {
                throw new ArgumentException("Usage: Updater.exe --pid <n> --app-dir <path> --exe <name> --staging <path> --version <x.y.z> --user-data <path>");
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
        readonly System.Windows.Forms.Timer _revealTimer;
        bool _closing;
        public int ExitCode;

        public UpdaterForm(Options opts)
        {
            _opts = opts;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            TopMost = true;
            ShowInTaskbar = false;
            WindowState = FormWindowState.Minimized;
            Opacity = 0;
            ClientSize = new Size(400, 120);
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
                Bounds = new Rectangle(0, 24, 400, 28)
            };

            _status = new Label
            {
                Text = "Applying update...",
                ForeColor = Color.FromArgb(190, 190, 190),
                Font = new Font("Segoe UI", 9.5f),
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Bounds = new Rectangle(0, 60, 400, 22)
            };

            var bar = new ProgressBar
            {
                Bounds = new Rectangle(40, 90, 320, 8),
                Style = ProgressBarStyle.Marquee,
                MarqueeAnimationSpeed = 25
            };

            Controls.Add(title);
            Controls.Add(_status);
            Controls.Add(bar);

            _revealTimer = new System.Windows.Forms.Timer { Interval = 1500 };
            _revealTimer.Tick += (s, e) => Reveal();

            Shown += (s, e) =>
            {
                _revealTimer.Start();
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

        void Reveal()
        {
            _revealTimer.Stop();
            if (_closing) return;
            WindowState = FormWindowState.Normal;
            ShowInTaskbar = true;
            Opacity = 1;
            CenterToScreen();
            TopMost = true;
            Activate();
        }

        void SetStatus(string text, Color? color = null)
        {
            BeginInvoke((Action)(() =>
            {
                _status.Text = text;
                _status.ForeColor = color ?? Color.FromArgb(190, 190, 190);
            }));
        }

        void CloseSelf()
        {
            BeginInvoke((Action)(() =>
            {
                _closing = true;
                _revealTimer.Stop();
                Close();
            }));
        }

        void Run()
        {
            var appDir = _opts.AppDir.TrimEnd('\\');
            var stagingDir = _opts.StagingDir.TrimEnd('\\');
            var backupDir = appDir + ".backup";
            var appExePath = Path.Combine(appDir, _opts.ExeName);
            var swapMarker = Path.Combine(_opts.UserData, ".swap-pending");
            var healthPending = Path.Combine(_opts.UserData, ".update-health-pending");
            var healthAck = Path.Combine(_opts.UserData, ".update-health-ok");
            bool installIntact = true;

            try
            {
                Log.Write("=== swapper start v" + _opts.Version + " pid=" + _opts.Pid + " appDir=" + appDir);

                FileOps.TryDeleteDir(backupDir, 3);
                CleanupStaleSiblings();

                if (!Directory.Exists(stagingDir))
                {
                    throw new UpdateException(5, "Staging directory not found: " + stagingDir);
                }

                WaitForAppExit();

                try { File.WriteAllText(swapMarker, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString()); }
                catch { }

                try
                {
                    FileOps.RetryMove(appDir, backupDir, 10);
                }
                catch (Exception ex)
                {
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
                    Reveal();
                    try
                    {
                        FileOps.RetryMove(backupDir, appDir, 10);
                        installIntact = true;
                        throw new UpdateException(6, "Update failed, previous version restored: " + ex.Message, ex);
                    }
                    catch (UpdateException) { throw; }
                    catch (Exception rollbackEx)
                    {
                        throw new UpdateException(7, "Update failed and rollback failed: " + rollbackEx.Message, rollbackEx);
                    }
                }

                Log.Write("swap complete");
                FileOps.TryDeleteFile(swapMarker);
                FileOps.TryDeleteFile(healthAck);
                try
                {
                    File.WriteAllText(healthPending, _opts.Version);
                }
                catch (Exception ex)
                {
                    RollbackUnhealthyUpdate(null, appDir, backupDir);
                    FileOps.TryDeleteFile(healthPending);
                    throw new UpdateException(8, "Could not create the update recovery marker; the previous version was restored: " + ex.Message, ex);
                }
                WriteJustUpdatedFlag();
                FileOps.TryDeleteFile(Path.Combine(_opts.UserData, ".update-failed"));

                SetStatus("Starting application...");
                Process relaunched = Relaunch(appExePath, appDir);

                if (relaunched == null || !WaitForHealthAck(relaunched, healthAck))
                {
                    Log.Write("new version did not report a healthy startup; rolling back");
                    SetStatus("Restoring previous version...", Color.FromArgb(230, 160, 60));
                    Reveal();
                    RollbackUnhealthyUpdate(relaunched, appDir, backupDir);
                    FileOps.TryDeleteFile(healthPending);
                    FileOps.TryDeleteFile(healthAck);
                    FileOps.TryDeleteFile(Path.Combine(_opts.UserData, ".just-updated"));
                    throw new UpdateException(8, "The new version did not start correctly; the previous version was restored.");
                }

                UpdateUninstallRegistry();
                FileOps.TryDeleteFile(healthPending);
                FileOps.TryDeleteFile(healthAck);
                if (!FileOps.TryDeleteDir(backupDir, 5))
                {
                    Log.Write("healthy update completed, but backup cleanup will be retried on next start");
                }

                Log.Write("update finished successfully");
                ExitCode = 0;
            }
            catch (UpdateException ex)
            {
                Fail(ex.Code, ex.Message, installIntact, appExePath, appDir);
            }
            catch (Exception ex)
            {
                Fail(9, ex.ToString(), installIntact, appExePath, appDir);
            }
            finally
            {
                CloseSelf();
            }
        }

        void Fail(int code, string message, bool installIntact, string appExePath, string appDir)
        {
            Log.Write("FAILED (exit " + code + "): " + message);
            ExitCode = code;
            FileOps.TryDeleteFile(Path.Combine(_opts.UserData, "update-info.json"));
            DeleteProgramDataUpdateInfo();
            try { File.WriteAllText(Path.Combine(_opts.UserData, ".update-failed"), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString()); }
            catch { }

            if (code == 7)
            {
                SetStatus("Update failed", Color.FromArgb(220, 80, 80));
                Reveal();
                MessageBox.Show(
                    "The update failed and the previous version could not be restored.\nPlease reinstall the application from:\nhttps://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases/latest",
                    "Make Your Life Easier - Update Failed",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            if (installIntact && File.Exists(appExePath))
            {
                Relaunch(appExePath, appDir);
            }
        }

        void CleanupStaleSiblings()
        {
            try
            {
                var selfDir = Path.GetDirectoryName(Path.GetFullPath(Application.ExecutablePath));
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

        void WaitForAppExit()
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

            Thread.Sleep(500);
            Log.Write("app exited");
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

        void DeleteProgramDataUpdateInfo()
        {
            try
            {
                var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                FileOps.TryDeleteFile(Path.Combine(programData, "MakeYourLifeEasier", "update-info.json"));
            }
            catch { }
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

        bool WaitForHealthAck(Process launched, string healthAck)
        {
            var deadline = DateTime.UtcNow.AddSeconds(90);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    if (File.Exists(healthAck) && string.Equals(File.ReadAllText(healthAck).Trim(), _opts.Version, StringComparison.Ordinal))
                    {
                        Log.Write("received healthy startup acknowledgement for v" + _opts.Version);
                        return true;
                    }
                }
                catch (Exception ex) { Log.Write("health acknowledgement read failed: " + ex.Message); }

                try
                {
                    if (launched != null && launched.HasExited)
                    {
                        Log.Write("new application exited before health acknowledgement");
                        return false;
                    }
                }
                catch { return false; }

                Thread.Sleep(500);
            }

            Log.Write("timed out waiting for healthy startup acknowledgement");
            return false;
        }

        void RollbackUnhealthyUpdate(Process launched, string appDir, string backupDir)
        {
            if (launched != null)
            {
                try
                {
                    if (!launched.HasExited)
                    {
                        var kill = Process.Start(new ProcessStartInfo
                        {
                            FileName = "taskkill",
                            Arguments = "/PID " + launched.Id + " /T /F",
                            CreateNoWindow = true,
                            UseShellExecute = false
                        });
                        if (kill != null) kill.WaitForExit(10000);
                    }
                }
                catch (Exception ex) { Log.Write("failed to stop unhealthy version: " + ex.Message); }
            }

            Thread.Sleep(1000);
            var failedDir = appDir + ".failed";
            FileOps.TryDeleteDir(failedDir, 3);
            try
            {
                FileOps.RetryMove(appDir, failedDir, 10);
                FileOps.RetryMove(backupDir, appDir, 10);
                FileOps.TryDeleteDir(failedDir, 3);
                Log.Write("previous version restored after failed health check");
            }
            catch (Exception ex)
            {
                throw new UpdateException(7, "Health check failed and rollback failed: " + ex.Message, ex);
            }
        }

        Process Relaunch(string appExePath, string appDir)
        {
            try
            {
                var process = Process.Start(new ProcessStartInfo
                {
                    FileName = appExePath,
                    WorkingDirectory = appDir,
                    UseShellExecute = true
                });
                Log.Write("relaunched " + appExePath);
                return process;
            }
            catch (Exception ex)
            {
                Log.Write("relaunch failed: " + ex.Message);
                return null;
            }
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
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
            Log.Write("=== swapper exit " + form.ExitCode);
            return form.ExitCode;
        }
    }
}
