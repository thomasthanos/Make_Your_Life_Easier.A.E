using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
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

    static class Native
    {
        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();

        [DllImport("dwmapi.dll")]
        static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

        [DllImport("dwmapi.dll")]
        static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

        [StructLayout(LayoutKind.Sequential)]
        struct Margins { public int Left, Right, Top, Bottom; }

        const int DWMWA_NCRENDERING_POLICY = 2;
        const int DWMNCRP_ENABLED = 2;
        const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        const int DWMWA_BORDER_COLOR = 34;
        const int DWMWCP_ROUND = 2;

        /// <summary>
        /// Give a borderless window the system shadow and, on Windows 11,
        /// rounded corners with a thin border. Older versions ignore what
        /// they do not support and keep a square window.
        /// </summary>
        public static void StyleWindow(IntPtr hwnd, Color border)
        {
            try
            {
                int policy = DWMNCRP_ENABLED;
                DwmSetWindowAttribute(hwnd, DWMWA_NCRENDERING_POLICY, ref policy, sizeof(int));
                var margins = new Margins { Left = 1, Right = 1, Top = 1, Bottom = 1 };
                DwmExtendFrameIntoClientArea(hwnd, ref margins);
                int corner = DWMWCP_ROUND;
                DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref corner, sizeof(int));
                int colorRef = border.R | (border.G << 8) | (border.B << 16);
                DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, ref colorRef, sizeof(int));
            }
            catch { }
        }
    }

    sealed class UpdaterForm : Form
    {
        // Drawn like the app's own update window (src/updater/update.html), so
        // going from that window to this one and on to the app reads as one
        // step. Sizes are in DIPs, as in the web card.
        const float CardWidth = 610f;
        const float CardHeight = 380f;
        static readonly RectangleF IconBox = new RectangleF(258f, 58f, 94f, 94f);
        static readonly RectangleF TitleBox = new RectangleF(0f, 168f, CardWidth, 56f);
        static readonly RectangleF TrackBox = new RectangleF(48f, 250f, 514f, 58f);

        static readonly Color CardTop = Color.FromArgb(43, 54, 74);
        static readonly Color CardBottom = Color.FromArgb(22, 30, 45);
        static readonly Color TrackTop = Color.FromArgb(20, 27, 46);
        static readonly Color TrackBottom = Color.FromArgb(10, 17, 34);
        static readonly Color TitleColor = Color.FromArgb(244, 248, 255);
        static readonly Color TextColor = Color.FromArgb(243, 248, 255);
        static readonly Color WarnColor = Color.FromArgb(242, 180, 96);
        static readonly Color ErrorColor = Color.FromArgb(240, 110, 110);
        static readonly Color BorderColor = Color.FromArgb(78, 92, 116);

        readonly Options _opts;
        readonly float _scale;
        readonly Bitmap _icon;
        readonly Font _titleFont;
        readonly Font _labelFont;
        readonly Stopwatch _clock = Stopwatch.StartNew();
        readonly System.Windows.Forms.Timer _animation;
        readonly System.Windows.Forms.Timer _revealTimer;
        readonly System.Windows.Forms.Timer _fadeTimer;
        double _fadeTarget;
        Action _afterFade;
        string _status;
        Color _statusColor;
        bool _revealed;
        bool _dismissed;
        public int ExitCode;

        public UpdaterForm(Options opts)
        {
            _opts = opts;
            using (var screen = Graphics.FromHwnd(IntPtr.Zero))
            {
                _scale = screen.DpiX / 96f;
            }

            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            TopMost = true;
            ShowInTaskbar = false;
            // Minimised and transparent until there is something to show, so
            // the window can neither flash nor catch clicks
            WindowState = FormWindowState.Minimized;
            Opacity = 0;
            ClientSize = new Size((int)Math.Round(CardWidth * _scale), (int)Math.Round(CardHeight * _scale));
            BackColor = CardBottom;
            Text = "Make Your Life Easier - Updater";
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            _icon = LoadAppIcon();
            _titleFont = MakeFont("Segoe Print", 38f, FontStyle.Bold);
            _labelFont = MakeFont("Segoe UI Semibold", 17f, FontStyle.Regular);
            _status = "Installing update v" + opts.Version + "…";
            _statusColor = TextColor;

            _animation = new System.Windows.Forms.Timer { Interval = 16 };
            _animation.Tick += (s, e) => Invalidate(Rectangle.Inflate(Scaled(TrackBox), 2, 2));

            // The app closes its own update window about 300 ms after starting
            // this process; take over right after that, or as soon as it exits
            _revealTimer = new System.Windows.Forms.Timer { Interval = 450 };
            _revealTimer.Tick += (s, e) => Reveal();

            _fadeTimer = new System.Windows.Forms.Timer { Interval = 15 };
            _fadeTimer.Tick += (s, e) => FadeStep();

            Shown += (s, e) =>
            {
                _animation.Start();
                _revealTimer.Start();
                var worker = new Thread(Run) { IsBackground = true };
                worker.Start();
            };
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Native.StyleWindow(Handle, BorderColor);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            if (ClientSize.Width <= 0 || ClientSize.Height <= 0) return;
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;

            var card = new RectangleF(0f, 0f, ClientSize.Width, ClientSize.Height);
            using (var background = new LinearGradientBrush(card, CardTop, CardBottom, LinearGradientMode.Vertical))
            {
                g.FillRectangle(background, card);
            }
            using (var sheen = new LinearGradientBrush(card, Color.FromArgb(30, 255, 255, 255), Color.FromArgb(0, 255, 255, 255), 35f))
            {
                g.FillRectangle(sheen, card);
            }

            if (_icon != null) g.DrawImage(_icon, ScaledF(IconBox));

            using (var title = new SolidBrush(TitleColor))
            using (var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
            {
                g.DrawString("Make Your Life Easier", _titleFont, title, ScaledF(TitleBox), format);
            }

            PaintTrack(g);
        }

        void PaintTrack(Graphics g)
        {
            RectangleF track = ScaledF(TrackBox);
            using (GraphicsPath pill = Pill(track))
            {
                using (var background = new LinearGradientBrush(track, TrackTop, TrackBottom, LinearGradientMode.Vertical))
                {
                    g.FillPath(background, pill);
                }

                // The web bar's blue gradient, drifting like its shimmer. The
                // swap has no measurable progress, so the bar stays full.
                float drift = (float)((_clock.Elapsed.TotalSeconds / 2.0) % 1.0) * track.Width;
                var band = new RectangleF(track.X - drift, track.Y, track.Width, track.Height);
                using (var fill = new LinearGradientBrush(band, Color.Black, Color.Black, LinearGradientMode.Horizontal))
                {
                    var blend = new ColorBlend(5);
                    blend.Colors = new[]
                    {
                        Color.FromArgb(199, 73, 112, 219), Color.FromArgb(158, 83, 166, 238),
                        Color.FromArgb(77, 73, 112, 219), Color.FromArgb(158, 83, 166, 238),
                        Color.FromArgb(199, 73, 112, 219)
                    };
                    blend.Positions = new[] { 0f, 0.25f, 0.5f, 0.75f, 1f };
                    fill.InterpolationColors = blend;
                    g.FillPath(fill, pill);
                }
                using (var edge = new Pen(Color.FromArgb(41, 255, 255, 255), Math.Max(1f, _scale)))
                {
                    g.DrawPath(edge, pill);
                }
            }

            float chipSize = 46f * _scale;
            var chip = new RectangleF(track.X + (6f * _scale), track.Y + ((track.Height - chipSize) / 2f), chipSize, chipSize);
            using (var chipBrush = new SolidBrush(Color.FromArgb(28, 255, 255, 255)))
            {
                g.FillEllipse(chipBrush, chip);
            }

            // A 25 px spinner with a 4 px border, measured at the stroke centre
            float ringSize = 21f * _scale;
            var ring = new RectangleF(chip.X + ((chipSize - ringSize) / 2f), chip.Y + ((chipSize - ringSize) / 2f), ringSize, ringSize);
            using (var ringPen = new Pen(Color.FromArgb(56, 235, 244, 255), 4f * _scale))
            {
                g.DrawEllipse(ringPen, ring);
            }
            float angle = (float)((_clock.Elapsed.TotalSeconds / 0.85) % 1.0) * 360f;
            using (var arcPen = new Pen(Color.FromArgb(235, 235, 244, 255), 4f * _scale))
            {
                arcPen.StartCap = LineCap.Round;
                arcPen.EndCap = LineCap.Round;
                g.DrawArc(arcPen, ring, angle - 90f, 90f);
            }

            var label = new RectangleF(chip.Right + (12f * _scale), track.Y, track.Right - chip.Right - (30f * _scale), track.Height);
            using (var brush = new SolidBrush(_statusColor))
            using (var format = new StringFormat(StringFormatFlags.NoWrap) { LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter })
            {
                g.DrawString(_status, _labelFont, brush, label, format);
            }
        }

        static GraphicsPath Pill(RectangleF r)
        {
            float d = r.Height;
            var path = new GraphicsPath();
            path.AddArc(r.X, r.Y, d, d, 90f, 180f);
            path.AddArc(r.Right - d, r.Y, d, d, 270f, 180f);
            path.CloseFigure();
            return path;
        }

        RectangleF ScaledF(RectangleF r)
        {
            return new RectangleF(r.X * _scale, r.Y * _scale, r.Width * _scale, r.Height * _scale);
        }

        Rectangle Scaled(RectangleF r)
        {
            return Rectangle.Round(ScaledF(r));
        }

        Font MakeFont(string family, float px, FontStyle style)
        {
            try
            {
                using (new FontFamily(family)) { }
                return new Font(family, px * _scale, style, GraphicsUnit.Pixel);
            }
            catch (ArgumentException)
            {
                return new Font("Segoe UI", px * _scale, style, GraphicsUnit.Pixel);
            }
        }

        /// <summary>
        /// The app icon at full size. hacker.ico is embedded at build time; its
        /// 256 px frame is a PNG, which GDI+ decodes more reliably than Icon does.
        /// </summary>
        static Bitmap LoadAppIcon()
        {
            try
            {
                using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("MyleUpdater.hacker.ico"))
                {
                    if (stream != null)
                    {
                        var data = new byte[stream.Length];
                        int read = 0;
                        while (read < data.Length)
                        {
                            int n = stream.Read(data, read, data.Length - read);
                            if (n <= 0) break;
                            read += n;
                        }
                        int count = BitConverter.ToUInt16(data, 4);
                        int best = -1;
                        int bestSize = 0;
                        for (int i = 0; i < count; i++)
                        {
                            int size = data[6 + (i * 16)] == 0 ? 256 : data[6 + (i * 16)];
                            if (size > bestSize) { bestSize = size; best = i; }
                        }
                        if (best >= 0)
                        {
                            int length = BitConverter.ToInt32(data, 6 + (best * 16) + 8);
                            int offset = BitConverter.ToInt32(data, 6 + (best * 16) + 12);
                            using (var frame = new MemoryStream(data, offset, length))
                            using (var image = Image.FromStream(frame))
                            {
                                return new Bitmap(image);
                            }
                        }
                    }
                }
            }
            catch { }

            try
            {
                using (var icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath))
                {
                    return icon.ToBitmap();
                }
            }
            catch
            {
                return null;
            }
        }

        void UI(Action action)
        {
            try { BeginInvoke(action); }
            catch (InvalidOperationException) { }
        }

        void Reveal()
        {
            _revealTimer.Stop();
            if (_revealed || _dismissed) return;
            _revealed = true;
            WindowState = FormWindowState.Normal;
            CenterToScreen();
            ShowInTaskbar = true;
            TopMost = true;
            Activate();
            FadeTo(1.0, null);
        }

        void ShowCard()
        {
            UI(Reveal);
        }

        // Fade out as soon as the new version is on screen: the clean-up after
        // it (registry, markers, deleting the old copy) needs no window
        void Dismiss()
        {
            _dismissed = true;
            _revealTimer.Stop();
            if (!_revealed) return;
            FadeTo(0.0, () =>
            {
                Hide();
                _animation.Stop();
            });
        }

        void FadeTo(double target, Action then)
        {
            _fadeTarget = target;
            _afterFade = then;
            _fadeTimer.Start();
        }

        void FadeStep()
        {
            double next = Opacity < _fadeTarget
                ? Math.Min(_fadeTarget, Opacity + 0.12)
                : Math.Max(_fadeTarget, Opacity - 0.12);
            Opacity = next;
            if (Math.Abs(next - _fadeTarget) > 0.001) return;

            _fadeTimer.Stop();
            var then = _afterFade;
            _afterFade = null;
            if (then != null) then();
        }

        void SetStatus(string text, Color? color = null)
        {
            UI(() =>
            {
                _status = text;
                _statusColor = color ?? TextColor;
                Invalidate(Rectangle.Inflate(Scaled(TrackBox), 2, 2));
            });
        }

        void CloseSelf()
        {
            UI(() =>
            {
                _dismissed = true;
                _revealTimer.Stop();
                _fadeTimer.Stop();
                _animation.Stop();
                Close();
            });
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
                // The app and its update window are gone: cover the gap until
                // the new version is on screen
                ShowCard();

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
                    SetStatus("Restoring previous version…", WarnColor);
                    ShowCard();
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

                SetStatus("Starting Make Your Life Easier…");
                Process relaunched = Relaunch(appExePath, appDir);

                if (relaunched == null || !WaitForHealthAck(relaunched, healthAck))
                {
                    Log.Write("new version did not report a healthy startup; rolling back");
                    SetStatus("Restoring previous version…", WarnColor);
                    ShowCard();
                    RollbackUnhealthyUpdate(relaunched, appDir, backupDir);
                    FileOps.TryDeleteFile(healthPending);
                    FileOps.TryDeleteFile(healthAck);
                    FileOps.TryDeleteFile(Path.Combine(_opts.UserData, ".just-updated"));
                    throw new UpdateException(8, "The new version did not start correctly; the previous version was restored.");
                }

                // The new version acknowledged from its main window, so it is on screen
                UI(Dismiss);
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
                SetStatus("Update failed", ErrorColor);
                ShowCard();
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

                // Short, so this window leaves the moment the new version shows
                Thread.Sleep(100);
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
            // Drawn at the screen's real DPI instead of being stretched blurry
            try { Native.SetProcessDPIAware(); } catch { }

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
