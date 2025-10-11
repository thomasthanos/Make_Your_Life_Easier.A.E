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
    def __init__(self):
        super().__init__()
        self.setWindowTitle("🚀 GitHub Release Manager - Simplified")
        self.setGeometry(100, 100, 1200, 800)
        
        # Variables
        self.version = "1.0.0"
        self.release_type = "patch"
        self.project_path = ""
        self.is_working = False
        self.current_workers = []
        self.command_queue = Queue()
        
        self.setup_ui()
        self.setup_styles()
        
        # Start queue processor
        self.queue_timer = QTimer()
        self.queue_timer.timeout.connect(self.process_command_queue)
        self.queue_timer.start(100)

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
        
        layout.addWidget(header)
        
        # Releases list
        self.releases_scroll = QScrollArea()
        self.releases_content = QWidget()
        self.releases_layout = QVBoxLayout(self.releases_content)
        self.releases_scroll.setWidget(self.releases_content)
        self.releases_scroll.setWidgetResizable(True)
        
        # Initial placeholder
        placeholder = QLabel("Click 'Refresh' to load releases")
        placeholder.setStyleSheet("color: #888888;")
        placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.releases_layout.addWidget(placeholder)
        
        self.releases_layout.addStretch()
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
        ]
        
        for text, command in action_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            actions_layout.addWidget(btn)
        
        layout.addWidget(actions_frame)
        layout.addStretch()

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
                QTimer.singleShot(0, lambda: callback(False))
            return False
            
        if check_git and not self.check_git_repository():
            if callback:
                QTimer.singleShot(0, lambda: callback(False))
            return False
            
        self.is_working = True
        self.progress_bar.setVisible(True)
        self.update_status("Working...")
        
        worker = CommandWorker(command, cwd or self.project_path)
        worker.output_signal.connect(self.log)
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
            
        current_version = self.version
        new_version = self.calculate_new_version(current_version, self.release_type)
        
        release_title = self.title_entry.text().strip() or f"v{new_version} - {self.release_type.capitalize()}"
        release_notes = self.notes_text.toPlainText().strip() or f"{self.release_type.capitalize()} release"
        
        temp_notes_file = Path(self.project_path) / "temp_release_notes.md"
        try:
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            create_command = f'gh release create v{new_version} ./dist/MakeYourLifeEasier-*.exe ./dist/latest.yml ./dist/*.blockmap --title "{release_title}" --notes-file "{temp_notes_file}"'
            
            def create_callback(success):
                try:
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    
                    if success:
                        self.version = new_version
                        self.version_display.setText(new_version)
                        self.log(f"🎉 v{new_version} created!", "success")
                        # Αυτόματο refresh των releases μετά από δημιουργία
                        QTimer.singleShot(2000, self.refresh_releases)
                except Exception as e:
                    self.log(f"❌ Cleanup error: {e}", "error")
            
            self.run_command_async(create_command, callback=create_callback)
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"❌ Error: {e}", "error")

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
                    
                    if success:
                        upload_command = f'gh release upload {latest_tag} ./dist/MakeYourLifeEasier-*.exe ./dist/latest.yml ./dist/*.blockmap --clobber'
                        self.run_command_async(upload_command, callback=lambda upload_success: (
                            self.log(f"✅ {latest_tag} updated successfully!", "success") if upload_success else
                            self.log(f"❌ Upload failed", "error")
                        ))
                        # Αυτόματο refresh των releases μετά από update
                        QTimer.singleShot(2000, self.refresh_releases)
                    else:
                        self.log(f"❌ Edit failed", "error")
                except Exception as e:
                    self.log(f"❌ Cleanup error: {e}", "error")
            
            self.run_command_async(edit_command, callback=edit_callback)
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"❌ Error: {e}", "error")

    def get_latest_release_tag(self):
        """Get the latest release tag from GitHub"""
        try:
            result = subprocess.run(
                ["gh", "release", "list", "--limit", "1"],
                capture_output=True, 
                text=True, 
                cwd=self.project_path
            )
            if result.returncode == 0 and result.stdout.strip():
                lines = result.stdout.strip().split('\n')
                if lines:
                    parts = lines[0].split('\t')
                    return parts[2].strip() if len(parts) > 2 else None
        except Exception as e:
            self.log(f"❌ Error getting latest release: {e}", "error")
        return None

    def get_all_releases(self):
        """Get all releases from GitHub"""
        try:
            result = subprocess.run(
                ["gh", "release", "list"],
                capture_output=True, 
                text=True, 
                cwd=self.project_path
            )
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                self.log(f"❌ Error getting releases: {result.stderr}", "error")
        except Exception as e:
            self.log(f"❌ Error getting releases: {e}", "error")
        return ""

    def delete_current_tag(self):
        if not self.check_git_repository():
            self.log("❌ Not git repo", "error")
            return
            
        version = self.version
        if not version:
            self.log("❌ No version", "error")
            return
        
        reply = QMessageBox.question(self, "Confirm", f"Delete v{version}?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        def delete_operations():
            commands = [
                f'gh release delete v{version} --yes',
                f'git tag -d v{version}',
                f'git push origin --delete v{version}'
            ]
            
            for cmd in commands:
                self.log(f"▶️ {cmd}", "info")
                success = self.run_command_sync(cmd)
                if not success:
                    break
                time.sleep(1)
            
            QTimer.singleShot(1000, self.refresh_releases)
        
        threading.Thread(target=delete_operations, daemon=True).start()

    def delete_specific_tag(self, tag):
        if not self.check_git_repository():
            return
        
        reply = QMessageBox.question(self, "Confirm", f"Delete {tag}?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        self.log(f"🗑️ Deleting {tag}...", "warning")
        
        def delete_operations():
            commands = [
                f'gh release delete {tag} --yes',
                f'git tag -d {tag}',
                f'git push origin --delete {tag}'
            ]
            
            for cmd in commands:
                success = self.run_command_sync(cmd)
                if not success:
                    break
                time.sleep(1)
            
            QTimer.singleShot(1000, self.refresh_releases)

        threading.Thread(target=delete_operations, daemon=True).start()

    def refresh_releases(self):
        """Refresh the releases list - FIXED VERSION"""
        if not self.check_git_repository():
            self.log("❌ Not a git repository", "error")
            return
            
        self.log("🔄 Refreshing releases...", "info")
        
        def get_releases():
            try:
                result = subprocess.run(
                    ["gh", "release", "list"],
                    capture_output=True, 
                    text=True, 
                    cwd=self.project_path,
                    timeout=30
                )
                
                if result.returncode == 0:
                    releases_output = result.stdout.strip()
                    QTimer.singleShot(0, lambda: self.display_releases(releases_output))
                    self.log("✅ Releases refreshed", "success")
                else:
                    error_msg = result.stderr.strip()
                    QTimer.singleShot(0, lambda: self.display_releases(""))
                    self.log(f"❌ Failed to get releases: {error_msg}", "error")
                    
            except subprocess.TimeoutExpired:
                QTimer.singleShot(0, lambda: self.display_releases(""))
                self.log("❌ Timeout getting releases", "error")
            except Exception as e:
                QTimer.singleShot(0, lambda: self.display_releases(""))
                self.log(f"❌ Error refreshing releases: {e}", "error")
        
        threading.Thread(target=get_releases, daemon=True).start()

    def display_releases(self, releases_output):
        """Display releases in the UI - FIXED VERSION"""
        # Clear existing releases
        while self.releases_layout.count():
            child = self.releases_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()
            
        if not releases_output.strip():
            placeholder = QLabel("No releases found")
            placeholder.setStyleSheet("color: #888888; padding: 20px;")
            placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.releases_layout.addWidget(placeholder)
            return
            
        try:
            releases = releases_output.strip().split('\n')
            found_releases = False
            
            for release in releases:
                parts = release.split('\t')
                if len(parts) < 3:
                    continue
                    
                title = parts[0].strip()
                type_str = parts[1].strip() if len(parts) > 1 else ''
                tag = parts[2].strip()
                date = parts[3].strip() if len(parts) > 3 else ''
                
                if not tag:
                    continue
                    
                found_releases = True
                
                release_frame = QFrame()
                release_frame.setStyleSheet("""
                    QFrame { 
                        background-color: #4a4a4a; 
                        margin: 5px; 
                        padding: 10px;
                        border-radius: 5px;
                    }
                """)
                release_layout = QVBoxLayout(release_frame)
                
                # Title row
                title_frame = QFrame()
                title_layout = QHBoxLayout(title_frame)
                title_layout.setContentsMargins(0, 0, 0, 0)
                
                title_label = QLabel(title)
                title_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
                title_label.setStyleSheet("color: white;")
                title_layout.addWidget(title_label)
                
                title_layout.addStretch()
                
                # Delete button
                delete_btn = QPushButton("🗑️")
                delete_btn.setFixedSize(30, 30)
                delete_btn.setStyleSheet("""
                    QPushButton {
                        background-color: #e74c3c;
                        border: none;
                        border-radius: 3px;
                        font-weight: bold;
                    }
                    QPushButton:hover {
                        background-color: #c0392b;
                    }
                """)
                delete_btn.clicked.connect(lambda checked, t=tag: self.delete_specific_tag(t))
                title_layout.addWidget(delete_btn)
                
                release_layout.addWidget(title_frame)
                
                # Info row
                info_text = f"Tag: {tag} | Date: {date}"
                info_label = QLabel(info_text)
                info_label.setStyleSheet("color: #cccccc; font-size: 10px;")
                release_layout.addWidget(info_label)
                
                # Status badge
                if type_str == 'Latest':
                    latest_label = QLabel("📍 LATEST RELEASE")
                    latest_label.setStyleSheet("""
                        QLabel {
                            color: #27ae60; 
                            font-weight: bold; 
                            font-size: 9px;
                            background-color: #2c3e50;
                            padding: 2px 5px;
                            border-radius: 3px;
                        }
                    """)
                    release_layout.addWidget(latest_label)
                elif type_str == 'Pre-release':
                    pre_label = QLabel("🧪 PRE-RELEASE")
                    pre_label.setStyleSheet("""
                        QLabel {
                            color: #f39c12; 
                            font-weight: bold; 
                            font-size: 9px;
                            background-color: #34495e;
                            padding: 2px 5px;
                            border-radius: 3px;
                        }
                    """)
                    release_layout.addWidget(pre_label)
                
                self.releases_layout.addWidget(release_frame)
            
            if not found_releases:
                placeholder = QLabel("No valid releases found")
                placeholder.setStyleSheet("color: #888888; padding: 20px;")
                placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
                self.releases_layout.addWidget(placeholder)
                
        except Exception as e:
            error_label = QLabel(f"Error displaying releases: {str(e)}")
            error_label.setStyleSheet("color: #e74c3c; padding: 20px;")
            error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.releases_layout.addWidget(error_label)
            self.log(f"❌ Error displaying releases: {e}", "error")
        
        self.releases_layout.addStretch()

    def command_finished(self, success, callback=None):
        self.is_working = False
        self.progress_bar.setVisible(False)
        self.update_status("Ready")
        
        if callback:
            callback(success)

    def update_status(self, message):
        self.status_bar.showMessage(message)
        
    def log(self, message, message_type="info"):
        if not message.strip():
            return
            
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        colors = {
            "info": "#ffffff",
            "success": "#27ae60", 
            "error": "#e74c3c",
            "warning": "#f39c12",
            "output": "#95a5a6",
            "timestamp": "#7f8c8d"
        }
        
        color = colors.get(message_type, "#ffffff")
        formatted_message = f'<span style="color: {colors["timestamp"]}">[{timestamp}]</span> <span style="color: {color}">{message}</span>'
        
        self.console_text.moveCursor(QTextCursor.MoveOperation.End)
        self.console_text.insertHtml(formatted_message + "<br>")
        self.console_text.moveCursor(QTextCursor.MoveOperation.End)
        
        # Auto-scroll to bottom
        scrollbar = self.console_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
        
    def clear_console(self):
        self.console_text.clear()
        
    def copy_console(self):
        clipboard = QGuiApplication.clipboard()
        clipboard.setText(self.console_text.toPlainText())
        self.log("📋 Copied", "success")
        
    # Navigation methods
    def show_releases(self):
        self.tab_widget.setCurrentIndex(0)
        self.refresh_releases()
        
    def show_quick_release(self):
        self.tab_widget.setCurrentIndex(1)
        
    def show_advanced(self):
        self.tab_widget.setCurrentIndex(2)
        
    def browse_project_path(self):
        path = QFileDialog.getExistingDirectory(self, "Select Project Directory")
        if path:
            self.project_path = path
            self.path_label.setText(path)
            self.load_package_json(path)
            self.update_project_status()
            # Auto-refresh releases when project is selected
            QTimer.singleShot(500, self.refresh_releases)
            
    def load_package_json(self, path):
        package_json_path = Path(path) / "package.json"
        if package_json_path.exists():
            try:
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.version = data.get('version', 'Unknown')
                    self.version_display.setText(self.version)
            except Exception as e:
                self.log(f"❌ package.json error: {e}", "error")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # Set dark theme
    app.setStyle('Fusion')
    
    window = ModernReleaseManager()
    window.show()
    
    sys.exit(app.exec())