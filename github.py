import sys
import os
import json
import subprocess
import threading
import time
import shutil
from pathlib import Path
from datetime import datetime
from queue import Queue, Empty

from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                            QLabel, QPushButton, QTextEdit, QLineEdit, QProgressBar,
                            QTabWidget, QFrame, QScrollArea, QRadioButton, QButtonGroup,
                            QFileDialog, QMessageBox, QMenu, QSplitter, QSizePolicy)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor, QAction, QTextCursor, QGuiApplication

try:
    import psutil
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
    import psutil

class CommandWorker(QThread):
    """Worker thread for running commands safely"""
    output_signal = pyqtSignal(str, str)
    finished_signal = pyqtSignal(bool)
    command_signal = pyqtSignal(str)

    def __init__(self, command, cwd=None):
        super().__init__()
        self.command = command
        self.cwd = cwd
        self._is_running = True

    def run(self):
        try:
            self.command_signal.emit(f"▶️ {self.command}")
            
            process = subprocess.Popen(
                self.command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=self.cwd,
                bufsize=1,
                universal_newlines=True
            )
            
            while self._is_running:
                line = process.stdout.readline()
                if not line:
                    break
                if line.strip():
                    self.output_signal.emit(line.strip(), "output")
            
            if self._is_running:
                process.wait()
                if process.returncode == 0:
                    self.output_signal.emit("✅ Command completed successfully", "success")
                    self.finished_signal.emit(True)
                else:
                    self.output_signal.emit(f"❌ Command failed with code: {process.returncode}", "error")
                    self.finished_signal.emit(False)
                    
        except Exception as e:
            self.output_signal.emit(f"❌ Error: {str(e)}", "error")
            self.finished_signal.emit(False)

    def stop(self):
        self._is_running = False
        self.terminate()
        self.wait()

class ModernReleaseManager(QMainWindow):
    log_signal = pyqtSignal(str, str)
    update_releases_signal = pyqtSignal(list, list)
    reset_refreshing_signal = pyqtSignal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("🚀 GitHub Release Manager - Simplified")
        self.setGeometry(100, 100, 1200, 800)
        
        # Variables
        self.version = "1.0.0"
        self.release_type = "patch"
        self.project_path = ""
        self.is_working = False
        self.is_refreshing = False
        self.current_workers = []
        self.command_queue = Queue()
        
        self.setup_ui()
        self.setup_styles()
        
        self.log_signal.connect(self._log_to_console)
        self.update_releases_signal.connect(self.update_releases_display)
        self.reset_refreshing_signal.connect(self._reset_refreshing)
        
        # Start queue processor
        self.queue_timer = QTimer()
        self.queue_timer.timeout.connect(self.process_command_queue)
        self.queue_timer.start(100)

    def _reset_refreshing(self):
        self.is_refreshing = False

    def setup_styles(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #2b2b2b;
                color: #ffffff;
            }
            QFrame {
                background-color: #3c3c3c;
                border-radius: 5px;
                border: 1px solid #555555;
            }
            QLabel {
                color: #ffffff;
                padding: 5px;
            }
            QPushButton {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #005a9e;
            }
            QPushButton:disabled {
                background-color: #555555;
                color: #888888;
            }
            QPushButton.danger {
                background-color: #e74c3c;
            }
            QPushButton.danger:hover {
                background-color: #c0392b;
            }
            QPushButton.success {
                background-color: #27ae60;
            }
            QPushButton.success:hover {
                background-color: #219653;
            }
            QTextEdit, QLineEdit {
                background-color: #1e1e1e;
                color: #ffffff;
                border: 1px solid #555555;
                border-radius: 4px;
                padding: 5px;
                font-family: 'Consolas', monospace;
            }
            QProgressBar {
                border: 1px solid #555555;
                border-radius: 4px;
                background-color: #1e1e1e;
                text-align: center;
                color: white;
            }
            QProgressBar::chunk {
                background-color: #007acc;
                border-radius: 3px;
            }
            QTabWidget::pane {
                border: 1px solid #555555;
                background-color: #3c3c3c;
            }
            QTabBar::tab {
                background-color: #2b2b2b;
                color: #ffffff;
                padding: 8px 15px;
                border: 1px solid #555555;
                border-bottom: none;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #007acc;
            }
            QTabBar::tab:hover {
                background-color: #005a9e;
            }
            QRadioButton {
                color: #ffffff;
                spacing: 8px;
            }
            QRadioButton::indicator {
                width: 16px;
                height: 16px;
                border-radius: 8px;
                border: 2px solid #888888;
            }
            QRadioButton::indicator:checked {
                background-color: #007acc;
                border: 2px solid #007acc;
            }
            QScrollArea {
                border: none;
                background-color: transparent;
            }
        """)

    def setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Sidebar
        self.create_sidebar(main_layout)
        
        # Main content area
        self.create_main_content(main_layout)
        
        # Status bar
        self.create_status_bar()

    def create_sidebar(self, parent_layout):
        sidebar = QFrame()
        sidebar.setFixedWidth(250)
        sidebar.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(10, 10, 10, 10)
        sidebar_layout.setSpacing(10)
        
        # Project Section
        project_section = QFrame()
        project_layout = QVBoxLayout(project_section)
        
        project_label = QLabel("PROJECT")
        project_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        project_label.setStyleSheet("color: #888888;")
        project_layout.addWidget(project_label)
        
        # Project Path
        self.select_path_btn = QPushButton("📁 Select Project")
        self.select_path_btn.clicked.connect(self.browse_project_path)
        project_layout.addWidget(self.select_path_btn)
        
        self.path_label = QLabel("No project selected")
        self.path_label.setWordWrap(True)
        self.path_label.setStyleSheet("color: #888888; font-size: 10px;")
        project_layout.addWidget(self.path_label)
        
        # Version Info
        version_label = QLabel("Current Version:")
        project_layout.addWidget(version_label)
        
        self.version_display = QLabel("1.0.0")
        self.version_display.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        project_layout.addWidget(self.version_display)
        
        # Project Status
        self.project_status = QLabel("🔴 No project selected")
        self.project_status.setStyleSheet("color: #e74c3c; font-size: 10px;")
        project_layout.addWidget(self.project_status)
        
        project_layout.addStretch()
        sidebar_layout.addWidget(project_section)
        
        # Navigation
        nav_section = QFrame()
        nav_layout = QVBoxLayout(nav_section)
        
        nav_buttons = [
            ("📋 View Releases", self.show_releases),
            ("⚡ Quick Releases", self.show_quick_release),
            ("🔧 Advanced", self.show_advanced),
        ]
        
        for text, command in nav_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            btn.setStyleSheet("text-align: left; padding: 10px;")
            nav_layout.addWidget(btn)
        
        sidebar_layout.addWidget(nav_section)
        sidebar_layout.addStretch()
        
        parent_layout.addWidget(sidebar)

    def create_main_content(self, parent_layout):
        main_content = QFrame()
        main_layout = QVBoxLayout(main_content)
        
        # Tab widget
        self.tab_widget = QTabWidget()
        
        # Create tabs
        self.releases_tab = QWidget()
        self.quick_tab = QWidget()
        self.advanced_tab = QWidget()
        
        self.tab_widget.addTab(self.releases_tab, "📋 Releases")
        self.tab_widget.addTab(self.quick_tab, "⚡ Quick Releases")
        self.tab_widget.addTab(self.advanced_tab, "🔧 Advanced")
        
        self.setup_releases_tab()
        self.setup_quick_tab()
        self.setup_advanced_tab()
        
        main_layout.addWidget(self.tab_widget)
        
        # Console area
        console_frame = QFrame()
        console_layout = QVBoxLayout(console_frame)
        
        # Console header
        console_header = QFrame()
        console_header_layout = QHBoxLayout(console_header)
        
        console_label = QLabel("📟 Output Console")
        console_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        console_header_layout.addWidget(console_label)
        
        console_header_layout.addStretch()
        
        # Console buttons
        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(self.clear_console)
        console_header_layout.addWidget(clear_btn)
        
        copy_btn = QPushButton("Copy")
        copy_btn.clicked.connect(self.copy_console)
        console_header_layout.addWidget(copy_btn)
        
        stop_btn = QPushButton("Stop")
        stop_btn.clicked.connect(self.stop_all_commands)
        stop_btn.setStyleSheet("background-color: #e74c3c;")
        console_header_layout.addWidget(stop_btn)
        
        console_layout.addWidget(console_header)
        
        # Console text area
        self.console_text = QTextEdit()
        self.console_text.setFont(QFont("Consolas", 10))
        self.console_text.setReadOnly(True)
        console_layout.addWidget(self.console_text)
        
        main_layout.addWidget(console_frame)
        
        parent_layout.addWidget(main_content)

    def create_status_bar(self):
        self.status_bar = self.statusBar()
        self.status_bar.showMessage("Ready")
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setMaximumWidth(200)
        self.progress_bar.setVisible(False)
        self.status_bar.addPermanentWidget(self.progress_bar)

    def setup_releases_tab(self):
        layout = QVBoxLayout(self.releases_tab)
        
        # Header
        header = QFrame()
        header_layout = QHBoxLayout(header)
        
        title = QLabel("Release History")
        title.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh_releases)
        header_layout.addWidget(refresh_btn)
        
        # Test button for debugging
        test_btn = QPushButton("Test GitHub CLI")
        test_btn.clicked.connect(self.test_github_cli)
        header_layout.addWidget(test_btn)
        
        layout.addWidget(header)
        
        # Releases list - FIXED: Create proper scroll area
        self.releases_scroll = QScrollArea()
        self.releases_scroll.setWidgetResizable(True)
        self.releases_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.releases_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        
        # Create container widget for releases
        self.releases_container = QWidget()
        self.releases_layout = QVBoxLayout(self.releases_container)
        self.releases_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        
        # Initial placeholder
        self.placeholder_label = QLabel("Click 'Refresh' to load releases")
        self.placeholder_label.setStyleSheet("color: #888888; padding: 20px;")
        self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.releases_layout.addWidget(self.placeholder_label)
        
        self.releases_scroll.setWidget(self.releases_container)
        layout.addWidget(self.releases_scroll)

    def setup_quick_tab(self):
        layout = QVBoxLayout(self.quick_tab)
        
        # Release type selection
        type_frame = QFrame()
        type_layout = QVBoxLayout(type_frame)
        
        type_label = QLabel("Release Type")
        type_label.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        type_layout.addWidget(type_label)
        
        self.type_group = QButtonGroup()
        
        types = [
            ("🩹 Patch", "patch", "Bug fixes"),
            ("✨ Minor", "minor", "New features"),
            ("💥 Major", "major", "Breaking changes")
        ]
        
        for text, value, description in types:
            radio_frame = QFrame()
            radio_layout = QHBoxLayout(radio_frame)
            
            radio = QRadioButton(text)
            radio.setProperty("value", value)
            if value == "patch":
                radio.setChecked(True)
            
            self.type_group.addButton(radio)
            radio.toggled.connect(self.on_release_type_changed)
            radio_layout.addWidget(radio)
            
            desc_label = QLabel(description)
            desc_label.setStyleSheet("color: #888888;")
            radio_layout.addWidget(desc_label)
            radio_layout.addStretch()
            
            type_layout.addWidget(radio_frame)
        
        layout.addWidget(type_frame)
        
        # Quick action button
        quick_btn = QPushButton("🚀 Quick Release")
        quick_btn.clicked.connect(lambda: self.queue_command(self.auto_release))
        quick_btn.setStyleSheet("""
            QPushButton {
                font-size: 16px;
                height: 50px;
                background-color: #27ae60;
            }
            QPushButton:hover {
                background-color: #219653;
            }
        """)
        layout.addWidget(quick_btn)
        layout.addStretch()

    def setup_advanced_tab(self):
        layout = QVBoxLayout(self.advanced_tab)
        
        # Release details
        details_frame = QFrame()
        details_layout = QVBoxLayout(details_frame)
        
        details_label = QLabel("Release Details")
        details_label.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        details_layout.addWidget(details_label)
        
        # Version Input - NEW FIELD
        version_label = QLabel("Version:")
        details_layout.addWidget(version_label)
        
        version_layout = QHBoxLayout()
        
        self.version_entry = QLineEdit()
        self.version_entry.setPlaceholderText("e.g., 1.2.3")
        version_layout.addWidget(self.version_entry)
        
        # Button for suggesting version
        suggest_btn = QPushButton("Suggest")
        suggest_btn.clicked.connect(self.suggest_version)
        suggest_btn.setFixedWidth(80)
        version_layout.addWidget(suggest_btn)
        
        details_layout.addLayout(version_layout)
        
        # Title
        title_label = QLabel("Release Title:")
        details_layout.addWidget(title_label)
        
        self.title_entry = QLineEdit()
        self.title_entry.setPlaceholderText("Auto-generated if empty")
        details_layout.addWidget(self.title_entry)
        
        # Release Notes
        notes_label = QLabel("Release Notes:")
        details_layout.addWidget(notes_label)
        
        self.notes_text = QTextEdit()
        self.notes_text.setMaximumHeight(150)
        details_layout.addWidget(self.notes_text)
        
        layout.addWidget(details_frame)
        
        # Advanced actions
        actions_frame = QFrame()
        actions_layout = QVBoxLayout(actions_frame)
        
        actions_label = QLabel("Actions")
        actions_label.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        actions_layout.addWidget(actions_label)
        
        action_buttons = [
            ("🔨 Build", lambda: self.queue_command(self.safe_build_single)),
            ("📤 Update Latest Release", self.update_release),
            ("🗑️ Delete Latest Release", self.delete_current_tag),
            ("➕ Create Release", self.create_release),
            ("🔄 Clean & Rebuild", self.clean_and_rebuild),
        ]
        
        for text, command in action_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            actions_layout.addWidget(btn)
        
        layout.addWidget(actions_frame)
        layout.addStretch()

    def suggest_version(self):
        """Suggests the next version based on release_type"""
        current_version = self.version
        suggested_version = self.calculate_new_version(current_version, self.release_type)
        self.log(f"💡 Suggested version: {suggested_version}", "info")
        self.version_entry.setText(suggested_version)

    def on_release_type_changed(self):
        radio = self.sender()
        if radio.isChecked():
            self.release_type = radio.property("value")

    # Command Queue System
    def queue_command(self, command_func):
        self.command_queue.put(command_func)
        self.log(f"📋 Queued: {command_func.__name__}", "info")

    def process_command_queue(self):
        try:
            if not self.is_working and not self.command_queue.empty():
                command_func = self.command_queue.get_nowait()
                self.log(f"🚀 Executing: {command_func.__name__}", "info")
                # Run in main thread to avoid threading issues
                QTimer.singleShot(0, command_func)
        except Empty:
            pass

    def stop_all_commands(self):
        for worker in self.current_workers:
            worker.stop()
        self.current_workers.clear()
        
        while not self.command_queue.empty():
            try:
                self.command_queue.get_nowait()
            except Empty:
                break
        
        self.is_working = False
        self.progress_bar.setVisible(False)
        self.update_status("Stopped")
        self.log("🛑 All commands stopped", "warning")

    def test_github_cli(self):
        """Test if GitHub CLI is working - DIAGNOSTIC ONLY"""
        self.log("🧪 Testing GitHub CLI...", "info")
        
        def test_cli():
            try:
                self.log("Running gh --version", "info")
                # Test 1: Check if gh is installed
                result1 = subprocess.run(["gh", "--version"], capture_output=True, text=True)
                if result1.returncode != 0:
                    self.log("❌ GitHub CLI is not installed", "error")
                    self.log("💡 Install from: https://cli.github.com/", "info")
                    return
                
                self.log("✅ GitHub CLI is installed", "success")
                
                self.log("Running gh auth status", "info")
                # Test 2: Check authentication
                result2 = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
                if result2.returncode != 0:
                    self.log("❌ Not authenticated with GitHub CLI", "error")
                    self.log("💡 Run: gh auth login", "info")
                    return
                
                self.log("✅ Authenticated with GitHub", "success")
                
                # Test 3: Try to get releases (diagnostic only)
                if self.project_path:
                    self.log("Running gh release list", "info")
                    result3 = subprocess.run(["gh", "release", "list", "--limit", "3"], capture_output=True, text=True, cwd=self.project_path)
                    if result3.returncode == 0:
                        self.log(f"✅ GitHub CLI working - found releases", "success")
                        # Don't display release data in console - just confirm it works
                    else:
                        self.log(f"⚠️ GitHub CLI list error: {result3.stderr}", "warning")
                
            except Exception as e:
                self.log(f"❌ Error testing GitHub CLI: {e}", "error")
            finally:
                self.log("Test completed, refreshing releases", "info")
                QTimer.singleShot(0, self.refresh_releases)
        
        threading.Thread(target=test_cli, daemon=True).start()

    def check_project_selected(self):
        if not self.project_path:
            self.log("❌ Select project path first", "error")
            return False
        
        project_path = Path(self.project_path)
        if not project_path.exists():
            self.log("❌ Project path does not exist", "error")
            return False
            
        package_json = project_path / "package.json"
        if not package_json.exists():
            self.log("❌ package.json not found", "error")
            return False
            
        return True

    def check_git_repository(self):
        if not self.check_project_selected():
            return False
            
        project_path = Path(self.project_path)
        git_dir = project_path / ".git"
        
        if not git_dir.exists():
            self.log("❌ Not a git repository", "error")
            return False
            
        return True

    def check_dist_files_exist(self):
        if not self.check_project_selected():
            return False
            
        dist_path = Path(self.project_path) / "dist"
        
        if not dist_path.exists():
            self.log("❌ dist folder does not exist", "error")
            return False
        
        exe_patterns = ["MakeYourLifeEasier-*.exe", "*.exe", "*.AppImage", "*.dmg", "*.deb"]
        exe_files = []
        for pattern in exe_patterns:
            exe_files.extend(dist_path.glob(pattern))
            if exe_files:
                break
        
        has_exe = len(exe_files) > 0
        has_yml = len(list(dist_path.glob("latest.yml"))) > 0
        
        return has_exe and has_yml

    def update_project_status(self):
        if self.check_project_selected():
            if self.check_git_repository():
                self.project_status.setText("🟢 Ready (Git)")
                self.project_status.setStyleSheet("color: #27ae60;")
            else:
                self.project_status.setText("🟡 Ready (No Git)")
                self.project_status.setStyleSheet("color: #f39c12;")
        else:
            self.project_status.setText("🔴 No project")
            self.project_status.setStyleSheet("color: #e74c3c;")

    def kill_electron_only(self):
        self.log("🔫 Killing Electron processes...", "warning")
        electron_processes = ["electron.exe", "MakeYourLifeEasier.exe", "node.exe"]
        killed_count = 0
        
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                proc_name = proc.info['name'].lower()
                if any(target in proc_name for target in electron_processes):
                    proc.kill()
                    killed_count += 1
                    self.log(f"✅ Killed: {proc.info['name']}", "warning")
            except:
                pass
        
        time.sleep(3)
        self.log(f"✅ Killed {killed_count} processes", "success")

    def safe_delete_dist(self, max_retries=3):
        dist_path = Path(self.project_path) / "dist"
        
        if not dist_path.exists():
            return True
            
        for attempt in range(max_retries):
            try:
                self.kill_electron_only()
                shutil.rmtree(dist_path)
                return True
            except Exception as e:
                self.log(f"⚠️ Delete failed: {str(e)}", "warning")
                time.sleep(3)
        return False

    def clean_and_rebuild(self):
        """Clean everything and do a fresh rebuild"""
        if not self.check_project_selected():
            return
            
        self.log("🧹 Clean and rebuild...", "info")
        
        # Clean dist folder
        if self.safe_delete_dist():
            self.log("✅ Dist folder cleaned", "success")
        else:
            self.log("❌ Failed to clean dist folder", "error")
            return
            
        # Clean node_modules and reinstall
        def clean_operations():
            # Remove node_modules
            node_modules_path = Path(self.project_path) / "node_modules"
            if node_modules_path.exists():
                self.log("🧹 Removing node_modules...", "info")
                shutil.rmtree(node_modules_path)
                self.log("✅ node_modules removed", "success")
            
            # Remove package-lock.json
            package_lock_path = Path(self.project_path) / "package-lock.json"
            if package_lock_path.exists():
                package_lock_path.unlink()
                self.log("✅ package-lock.json removed", "success")
            
            # Reinstall dependencies
            self.log("📦 Reinstalling dependencies...", "info")
            if self.run_command_sync("npm install"):
                self.log("✅ Dependencies installed", "success")
                
                # Rebuild
                self.log("🔨 Rebuilding...", "info")
                if self.safe_build_single():
                    self.log("✅ Rebuild completed successfully", "success")
                else:
                    self.log("❌ Rebuild failed", "error")
            else:
                self.log("❌ Failed to install dependencies", "error")
        
        threading.Thread(target=clean_operations, daemon=True).start()

    def safe_build_single(self):
        if not self.check_project_selected():
            return False
            
        self.log("🛡️ Safe build...", "info")
        
        self.kill_electron_only()
        
        if not self.safe_delete_dist():
            return False
            
        time.sleep(2)
        
        build_commands = [
            "npm run build-all", "npm run build-portable", "npm run build-installer",
            "npm run build", "npm run dist", "npm run electron:build",
            "npx electron-builder", "npm run make"
        ]
        
        package_json_path = Path(self.project_path) / "package.json"
        available_scripts = []
        if package_json_path.exists():
            with open(package_json_path, 'r', encoding='utf-8') as f:
                scripts = json.load(f).get('scripts', {})
                for script_name in scripts:
                    if 'build' in script_name.lower() or 'dist' in script_name.lower() or 'electron' in script_name.lower():
                        available_scripts.append(script_name)
        
        success = False
        for build_cmd in build_commands:
            script_name = build_cmd.replace("npm run ", "").replace("npx ", "")
            if build_cmd.startswith("npm run ") and script_name not in available_scripts:
                continue
                
            self.log(f"🛠️ Trying: {build_cmd}", "info")
            if self._run_subprocess(build_cmd):
                time.sleep(5)
                if self.check_dist_files_exist():
                    success = True
                    break
        return success

    def _run_subprocess(self, command):
        try:
            process = subprocess.run(command, shell=True, capture_output=True, text=True, cwd=self.project_path, timeout=600)
            output = process.stdout + process.stderr
            tag = "output" if process.returncode == 0 else "error"
            self.log(output, tag)
            if process.returncode == 0:
                self.log("✅ Command success", "success")
            else:
                self.log(f"❌ Command failed: {process.returncode}", "error")
            return process.returncode == 0
        except Exception as e:
            self.log(f"❌ Error: {str(e)}", "error")
            return False

    def run_command_async(self, command, cwd=None, require_project=True, check_git=False, callback=None):
        if require_project and not self.check_project_selected():
            if callback:
                callback(False)
            return False
            
        if check_git and not self.check_git_repository():
            if callback:
                callback(False)
            return False
            
        self.is_working = True
        self.progress_bar.setVisible(True)
        self.update_status("Working...")
        
        worker = CommandWorker(command, cwd or self.project_path)
        worker.output_signal.connect(lambda msg, typ: self.log(msg, typ))
        worker.finished_signal.connect(lambda success: self.command_finished(success, callback))
        worker.command_signal.connect(lambda cmd: self.log(cmd, "info"))
        
        self.current_workers.append(worker)
        worker.start()
        
        return True

    def run_command_sync(self, command, cwd=None, require_project=True, check_git=False):
        """Run command synchronously without threading"""
        if require_project and not self.check_project_selected():
            return False
            
        if check_git and not self.check_git_repository():
            return False
            
        try:
            self.log(f"▶️ {command}", "info")
            process = subprocess.run(command, shell=True, capture_output=True, text=True, 
                                   cwd=cwd or self.project_path, timeout=300)
            output = process.stdout + process.stderr
            if process.returncode == 0:
                self.log(output, "output")
                self.log("✅ Command completed successfully", "success")
                return True
            else:
                self.log(output, "error")
                self.log(f"❌ Command failed: {process.returncode}", "error")
                return False
        except Exception as e:
            self.log(f"❌ Error: {str(e)}", "error")
            return False

    def auto_release(self):
        if not self.check_project_selected():
            return
            
        self.log("🚀 Auto release...", "info")
        
        if self.safe_build_single():
            time.sleep(5)
            if self.check_dist_files_exist():
                self.create_release()
            else:
                self.log("❌ Files missing", "error")

    def create_release(self):
        if not self.check_git_repository() or not self.check_dist_files_exist():
            self.log("❌ Checks failed", "error")
            return
        
        # Use version from input field
        new_version = self.version_entry.text().strip()
        
        # Validate version
        if not new_version:
            self.log("❌ Please enter a version number", "error")
            return
        
        # Validate version format (e.g. 1.2.3)
        import re
        if not re.match(r'^\d+\.\d+\.\d+$', new_version):
            self.log("❌ Version format should be X.Y.Z (e.g., 1.2.3)", "error")
            return
        
        release_title = self.title_entry.text().strip() or f"v{new_version}"
        release_notes = self.notes_text.toPlainText().strip() or f"Release v{new_version}"
        
        self.log(f"📋 Release Details:", "info")
        self.log(f"   Version: {new_version}", "info")
        self.log(f"   Title: {release_title}", "info")
        self.log(f"   Notes: {release_notes[:100]}...", "info")
        
        temp_notes_file = Path(self.project_path) / f"release_notes_{new_version}.md"
        
        try:
            # Write notes to file
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            self.log(f"📄 Notes written to: {temp_notes_file}", "info")
            
            # Check if file was created correctly
            if temp_notes_file.exists():
                file_size = temp_notes_file.stat().st_size
                self.log(f"📁 Notes file size: {file_size} bytes", "info")
            
            def create_release_sync():
                try:
                    # Create release with GitHub CLI
                    create_command = [
                        'gh', 'release', 'create', f'v{new_version}',
                        './dist/MakeYourLifeEasier-*.exe',
                        './dist/latest.yml',
                        './dist/*.blockmap',
                        '--title', release_title,
                        '--notes-file', str(temp_notes_file)
                    ]
                    
                    self.log(f"▶️ Executing: {' '.join(create_command)}", "info")
                    
                    result = subprocess.run(
                        create_command,
                        cwd=self.project_path,
                        capture_output=True,
                        text=True,
                        timeout=120
                    )
                    
                    # Cleanup temp file
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    
                    if result.returncode == 0:
                        self.log(f"✅ Release v{new_version} created successfully!", "success")
                        self.update_version_display(new_version)
                        QTimer.singleShot(3000, self.refresh_releases)
                    else:
                        error_msg = result.stderr if result.stderr else "Unknown error"
                        self.log(f"❌ Failed to create release: {error_msg}", "error")
                        
                except subprocess.TimeoutExpired:
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    self.log("❌ Timeout creating release", "error")
                except Exception as e:
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    self.log(f"❌ Error creating release: {e}", "error")
            
            # Run in thread to not block UI
            threading.Thread(target=create_release_sync, daemon=True).start()
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"❌ Error preparing release: {e}", "error")

    def update_version_display(self, new_version):
        """Update version in UI"""
        self.version = new_version
        self.version_display.setText(new_version)
        self.version_entry.clear()  # Clear the field

    def calculate_new_version(self, current_version, release_type):
        try:
            major, minor, patch = map(int, current_version.split('.'))
            if release_type == "patch": patch += 1
            elif release_type == "minor": minor += 1; patch = 0
            elif release_type == "major": major += 1; minor = 0; patch = 0
            return f"{major}.{minor}.{patch}"
        except:
            return "1.0.0"

    def update_release(self):
        """Improved update release that handles checksum issues - THREAD SAFE VERSION"""
        if not self.check_git_repository() or not self.check_dist_files_exist():
            self.log("❌ Checks failed", "error")
            return
        
        latest_tag = self.get_latest_release_tag()
        if not latest_tag:
            self.log("❌ No releases found on GitHub", "error")
            return
        
        version = latest_tag.lstrip('v')
        
        release_title = self.title_entry.text().strip()
        release_notes = self.notes_text.toPlainText().strip()
        
        if not release_title or not release_notes:
            self.log("❌ Enter title and notes", "error")
            return
        
        self.version = version
        self.version_display.setText(version)
        
        temp_notes_file = Path(self.project_path) / "temp_release_notes.md"
        try:
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            edit_command = f'gh release edit {latest_tag} --title "{release_title}" --notes-file "{temp_notes_file}"'
            
            def edit_callback(success):
                try:
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                except:
                    pass
                
                if success:
                    self.log("✅ Release updated", "success")
                    self.refresh_releases()
                else:
                    self.log("❌ Failed to update release", "error")
            
            self.run_command_async(edit_command, callback=edit_callback)
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"❌ Error: {str(e)}", "error")

    def delete_current_tag(self):
        """Delete the latest release and tag"""
        if not self.check_git_repository():
            return
        
        latest_tag = self.get_latest_release_tag()
        if not latest_tag:
            self.log("❌ No releases found", "error")
            return
        
        reply = QMessageBox.question(self, "Confirm Delete", 
                                   f"Delete release {latest_tag}? This cannot be undone!",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        self.log(f"🗑️ Deleting release {latest_tag}...", "warning")
        
        def delete_operations():
            try:
                # Delete release
                delete_release_cmd = f"gh release delete {latest_tag} --yes"
                if self.run_command_sync(delete_release_cmd):
                    self.log(f"✅ Release {latest_tag} deleted", "success")
                    
                    # Delete local tag
                    delete_local_tag_cmd = f"git tag -d {latest_tag}"
                    self.run_command_sync(delete_local_tag_cmd)
                    
                    # Delete remote tag
                    delete_remote_tag_cmd = f"git push origin --delete {latest_tag}"
                    self.run_command_sync(delete_remote_tag_cmd)
                    
                    QTimer.singleShot(0, self.refresh_releases)
                else:
                    self.log(f"❌ Failed to delete release {latest_tag}", "error")
            except Exception as e:
                self.log(f"❌ Error deleting: {e}", "error")
        
        threading.Thread(target=delete_operations, daemon=True).start()

    def get_latest_release_tag(self):
        """Get the latest release tag from GitHub"""
        try:
            result = subprocess.run(
                ["gh", "release", "list", "--limit", "1", "--json", "tagName"],
                capture_output=True, text=True, cwd=self.project_path
            )
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data:
                    return data[0]['tagName']
            return None
        except:
            return None

    def refresh_releases(self):
        """Refresh the releases list in the top panel"""
        if not self.check_git_repository():
            return
        
        if self.is_refreshing:
            self.log("🔄 Already refreshing, skipping...", "info")
            return
        
        self.is_refreshing = True
        self.log("🔄 Refreshing releases...", "info")
        
        def fetch_releases():
            releases = []
            all_tags = []
            try:
                self.log("Running gh release list command", "info")
                # Get releases from GitHub CLI
                result = subprocess.run(
                    ["gh", "release", "list", "--limit", "50", "--json", "tagName,name,createdAt,isDraft,isPrerelease,publishedAt"],
                    capture_output=True, text=True, cwd=self.project_path, timeout=30
                )
                
                self.log(f"gh command returncode: {result.returncode}", "info")
                if result.returncode == 0:
                    stdout = result.stdout.strip()
                    self.log(f"gh stdout: {stdout[:100]}...", "output")
                    if stdout:
                        try:
                            releases = json.loads(stdout)
                            self.log(f"✅ Found {len(releases)} releases via GitHub CLI", "success")
                        except json.JSONDecodeError as e:
                            self.log(f"❌ JSON parse error: {e}", "error")
                    else:
                        self.log("⚠️ Empty output from gh release list", "warning")
                else:
                    self.log(f"❌ gh release list failed with code {result.returncode}", "error")
                    self.log(f"Error: {result.stderr}", "error")
                    self.log("⚠️ No releases found via GitHub CLI", "warning")
                
                self.log("Running git tag command", "info")
                # Get all tags (including those without releases)
                tags_result = subprocess.run(
                    ["git", "tag", "--list", "--sort=-creatordate"],
                    capture_output=True, text=True, cwd=self.project_path, timeout=30
                )
                
                self.log(f"git tag returncode: {tags_result.returncode}", "info")
                if tags_result.returncode == 0:
                    stdout = tags_result.stdout.strip()
                    self.log(f"git stdout: {stdout[:100]}...", "output")
                    if stdout:
                        all_tags = [tag.strip() for tag in stdout.split('\n') if tag.strip()]
                        self.log(f"✅ Found {len(all_tags)} git tags", "success")
                    else:
                        self.log("⚠️ No git tags found", "warning")
                else:
                    self.log(f"❌ git tag failed with code {tags_result.returncode}", "error")
                    self.log(f"Error: {tags_result.stderr}", "error")
                
                # Update UI with releases and tags
                self.update_releases_signal.emit(releases, all_tags)
                
            except subprocess.TimeoutExpired:
                self.log("❌ Timeout fetching releases", "error")
            except Exception as e:
                self.log(f"❌ Error fetching releases: {e}", "error")
            finally:
                self.reset_refreshing_signal.emit()

        threading.Thread(target=fetch_releases, daemon=True).start()

    def update_releases_display(self, releases, all_tags):
        """Update the releases panel with releases and tags - FIXED VERSION"""
        # Clear existing content
        self.clear_releases_layout()
        
        if not releases and not all_tags:
            self.placeholder_label = QLabel("No releases or tags found\n\nMake sure:\n• GitHub CLI is installed (gh)\n• You are authenticated (gh auth login)\n• Repository has releases or tags")
            self.placeholder_label.setStyleSheet("color: #888888; padding: 20px; font-size: 12px;")
            self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.releases_layout.addWidget(self.placeholder_label)
            return
        
        # Create a set of release tags for quick lookup
        release_tags = {release['tagName'] for release in releases}
        
        # Display releases first
        if releases:
            releases_label = QLabel("GitHub Releases:")
            releases_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
            releases_label.setStyleSheet("color: #3498db; margin-top: 10px; margin-bottom: 5px;")
            self.releases_layout.addWidget(releases_label)
            
            for release in releases:
                self.add_release_item(release, is_release=True)
    
        # Display tags without releases
        tags_without_releases = [tag for tag in all_tags if tag not in release_tags]
        if tags_without_releases:
            tags_label = QLabel("Git Tags (No Release):")
            tags_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
            tags_label.setStyleSheet("color: #f39c12; margin-top: 20px; margin-bottom: 5px;")
            self.releases_layout.addWidget(tags_label)
            
            for tag in tags_without_releases:
                tag_item = {
                    'tagName': tag,
                    'name': tag,
                    'createdAt': '',
                    'publishedAt': '',
                    'isDraft': False,
                    'isPrerelease': False
                }
                self.add_release_item(tag_item, is_release=False)

    def clear_releases_layout(self):
        """Clear all widgets from releases layout except placeholder"""
        # Remove all widgets from layout
        while self.releases_layout.count():
            child = self.releases_layout.takeAt(0)
            if child.widget():
                # Keep track of placeholder to reuse it
                if child.widget() != self.placeholder_label:
                    child.widget().deleteLater()

    def add_release_item(self, release, is_release=True):
        """Add a release/tag item to the releases panel - FIXED VERSION"""
        item_frame = QFrame()
        item_frame.setStyleSheet("""
            QFrame {
                background-color: #4a4a4a;
                border-radius: 5px;
                border: 1px solid #666666;
                margin: 5px;
                padding: 5px;
            }
        """)
        
        item_layout = QHBoxLayout(item_frame)
        item_layout.setContentsMargins(10, 8, 10, 8)
        
        # Release info
        info_layout = QVBoxLayout()
        info_layout.setSpacing(2)
        
        # Title/tag
        title = release.get('name', release['tagName'])
        title_label = QLabel(title)
        title_label.setFont(QFont("Arial", 11, QFont.Weight.Bold))
        title_label.setStyleSheet("color: #ffffff;")
        title_label.setWordWrap(True)
        info_layout.addWidget(title_label)
        
        # Tag name and date
        meta_text = f"Tag: {release['tagName']}"
        
        # Use publishedAt for releases, createdAt for drafts
        date_str = ""
        if is_release:
            date_value = release.get('publishedAt') or release.get('createdAt', '')
            if date_value:
                try:
                    # Handle ISO format date
                    date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                    date_str = date_obj.strftime('%Y-%m-%d %H:%M')
                except:
                    date_str = date_value.split('T')[0]  # Just get date part
        
        if date_str:
            meta_text += f" | Date: {date_str}"
        
        if not is_release:
            meta_text += " | Git Tag Only"
        
        meta_label = QLabel(meta_text)
        meta_label.setStyleSheet("color: #888888; font-size: 9px;")
        info_layout.addWidget(meta_label)
        
        item_layout.addLayout(info_layout)
        item_layout.addStretch()
        
        # Status badges container
        badges_layout = QHBoxLayout()
        badges_layout.setSpacing(3)
        
        if is_release:
            if release.get('isDraft'):
                draft_label = QLabel("DRAFT")
                draft_label.setStyleSheet("""
                    QLabel {
                        background-color: #f39c12; 
                        color: white; 
                        padding: 2px 6px; 
                        border-radius: 3px; 
                        font-size: 8px;
                        font-weight: bold;
                    }
                """)
                badges_layout.addWidget(draft_label)
            
            if release.get('isPrerelease'):
                pre_label = QLabel("PRE-RELEASE")
                pre_label.setStyleSheet("""
                    QLabel {
                        background-color: #e67e22; 
                        color: white; 
                        padding: 2px 6px; 
                        border-radius: 3px; 
                        font-size: 8px;
                        font-weight: bold;
                    }
                """)
                badges_layout.addWidget(pre_label)
        
        item_layout.addLayout(badges_layout)
        
        # Delete button
        delete_btn = QPushButton("🗑️")
        delete_btn.setFixedSize(30, 30)
        delete_btn.setToolTip(f"Delete {release['tagName']}")
        delete_btn.setStyleSheet("""
            QPushButton {
                background-color: #e74c3c;
                border-radius: 3px;
                font-size: 12px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #c0392b;
            }
        """)
        delete_btn.clicked.connect(lambda checked, tag=release['tagName'], is_rel=is_release: 
                                 self.delete_release_tag(tag, is_rel))
        item_layout.addWidget(delete_btn)
        
        self.releases_layout.addWidget(item_frame)

    def delete_release_tag(self, tag_name, is_release=True):
        """Delete a specific release or tag"""
        reply = QMessageBox.question(
            self, 
            "Confirm Delete", 
            f"Delete {'release' if is_release else 'tag'} {tag_name}?\n\nThis action cannot be undone!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        self.log(f"🗑️ Deleting {'release' if is_release else 'tag'} {tag_name}...", "warning")
        
        def delete_operations():
            try:
                success = True
                
                if is_release:
                    # Delete GitHub release first
                    delete_release_cmd = f"gh release delete {tag_name} --yes"
                    result = subprocess.run(delete_release_cmd, shell=True, capture_output=True, text=True, 
                                          cwd=self.project_path, timeout=30)
                    
                    if result.returncode == 0:
                        self.log(f"✅ GitHub release {tag_name} deleted", "success")
                    else:
                        self.log(f"⚠️ Could not delete GitHub release (may not exist): {result.stderr}", "warning")
                        # Continue with tag deletion even if release delete fails
                
                # Delete local tag
                delete_local_cmd = f"git tag -d {tag_name}"
                local_result = subprocess.run(delete_local_cmd, shell=True, capture_output=True, text=True,
                                            cwd=self.project_path, timeout=30)
                
                if local_result.returncode == 0:
                    self.log(f"✅ Local tag {tag_name} deleted", "success")
                else:
                    self.log(f"⚠️ Could not delete local tag: {local_result.stderr}", "warning")
                    success = False
                
                # Delete remote tag
                delete_remote_cmd = f"git push origin --delete {tag_name}"
                remote_result = subprocess.run(delete_remote_cmd, shell=True, capture_output=True, text=True,
                                             cwd=self.project_path, timeout=30)
                
                if remote_result.returncode == 0:
                    self.log(f"✅ Remote tag {tag_name} deleted", "success")
                else:
                    self.log(f"⚠️ Could not delete remote tag: {remote_result.stderr}", "warning")
                    success = False
                
                if success:
                    self.log(f"✅ Successfully deleted {tag_name}", "success")
                else:
                    self.log(f"❌ Some operations failed for {tag_name}", "error")
                
                # Refresh the display regardless
                QTimer.singleShot(1000, self.refresh_releases)
                
            except subprocess.TimeoutExpired:
                self.log(f"❌ Timeout deleting {tag_name}", "error")
            except Exception as e:
                self.log(f"❌ Error deleting {tag_name}: {e}", "error")
        
        threading.Thread(target=delete_operations, daemon=True).start()

    def browse_project_path(self):
        path = QFileDialog.getExistingDirectory(self, "Select Project Directory")
        if path:
            self.project_path = path
            self.path_label.setText(os.path.basename(path))
            self.update_project_status()
            
            # Load version from package.json
            package_json_path = Path(path) / "package.json"
            if package_json_path.exists():
                try:
                    with open(package_json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        version = data.get('version', '1.0.0')
                        self.version = version
                        self.version_display.setText(version)
                        self.log(f"📦 Loaded version: {version}", "success")
                except Exception as e:
                    self.log(f"❌ Error reading package.json: {e}", "error")
            
            self.refresh_releases()

    def show_releases(self):
        self.tab_widget.setCurrentIndex(0)
        self.refresh_releases()

    def show_quick_release(self):
        self.tab_widget.setCurrentIndex(1)

    def show_advanced(self):
        self.tab_widget.setCurrentIndex(2)

    def log(self, message, message_type="output"):
        """Thread-safe logging using signal"""
        self.log_signal.emit(message, message_type)

    def _log_to_console(self, message, message_type):
        colors = {
            "error": "#e74c3c",
            "success": "#27ae60", 
            "warning": "#f39c12",
            "info": "#3498db",
            "output": "#ffffff"
        }
        
        color = colors.get(message_type, "#ffffff")
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_message = f'<span style="color: #888888;">[{timestamp}]</span> <span style="color: {color};">{message}</span><br>'
        
        self.console_text.moveCursor(QTextCursor.MoveOperation.End)
        self.console_text.insertHtml(formatted_message)
        self.console_text.moveCursor(QTextCursor.MoveOperation.End)
        
        # Auto-scroll
        scrollbar = self.console_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def clear_console(self):
        self.console_text.clear()

    def copy_console(self):
        clipboard = QGuiApplication.clipboard()
        clipboard.setText(self.console_text.toPlainText())
        self.log("📋 Console output copied to clipboard", "success")

    def command_finished(self, success, callback=None):
        self.is_working = False
        self.progress_bar.setVisible(False)
        self.update_status("Ready")
        
        if callback:
            callback(success)

    def update_status(self, message):
        self.status_bar.showMessage(message)

    def closeEvent(self, event):
        self.stop_all_commands()
        event.accept()

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("GitHub Release Manager")
    
    window = ModernReleaseManager()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()