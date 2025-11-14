import sys
import os
import json
import subprocess
import os
import threading
import time
import shutil
from pathlib import Path
from datetime import datetime
from queue import Queue, Empty

from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                            QLabel, QPushButton, QTextEdit, QLineEdit, QProgressBar,
                            QTabWidget, QFrame, QScrollArea, QRadioButton, QButtonGroup,
                            QFileDialog, QMessageBox, QMenu, QSplitter, QSizePolicy,
                            QGridLayout, QGroupBox, QCheckBox, QTextBrowser)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QFont, QPalette, QColor, QAction, QTextCursor, QGuiApplication

try:
    import psutil
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
    import psutil

import shlex

GIT_EXECUTABLE = shutil.which("git") or "git"
GH_EXECUTABLE = shutil.which("gh") or "gh"

try:
    import markdown
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "markdown"])
    import markdown

def _resolve_executable(exe: str) -> str:
    path = shutil.which(exe)
    if path is None and os.name == "nt" and not exe.lower().endswith(".cmd"):
        path = shutil.which(exe + ".cmd")
    return path or exe

class CommandWorker(QThread):
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
            self.command_signal.emit(f"{self.command}")
            if isinstance(self.command, str):
                cmd_list = shlex.split(self.command)
            else:
                cmd_list = self.command
            
            if cmd_list:
                resolved = _resolve_executable(cmd_list[0])
                cmd_list[0] = resolved
            try:
                process = subprocess.Popen(
                    cmd_list,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    cwd=self.cwd,
                    bufsize=1,
                    universal_newlines=True
                )
            except FileNotFoundError as fnf_err:
                self.output_signal.emit(f"Error: Executable not found: {cmd_list[0]} ({fnf_err})", "error")
                self.finished_signal.emit(False)
                return
            
            while self._is_running:
                line = process.stdout.readline()
                if not line:
                    break
                if line.strip():
                    self.output_signal.emit(line.strip(), "output")
            
            if self._is_running:
                process.wait()
                if process.returncode == 0:
                    self.output_signal.emit("Command completed successfully", "success")
                    self.finished_signal.emit(True)
                else:
                    self.output_signal.emit(f"Command failed with code: {process.returncode}", "error")
                    self.finished_signal.emit(False)
                    
        except Exception as e:
            self.output_signal.emit(f"Error: {str(e)}", "error")
            self.finished_signal.emit(False)

    def stop(self):
        self._is_running = False
        self.terminate()
        self.wait()

class BuildWorker(QThread):
    output_signal = pyqtSignal(str, str)
    finished_signal = pyqtSignal(bool)
    progress_signal = pyqtSignal(str)

    def __init__(self, commands, cwd=None):
        super().__init__()
        self.commands = commands
        self.cwd = cwd
        self._is_running = True

    def run(self):
        try:
            success = False
            for command in self.commands:
                # Exit if the worker has been stopped
                if not self._is_running:
                    break
                # Announce progress for this command
                self.progress_signal.emit(f"Running: {command}")
                self.output_signal.emit(f"Executing: {command}", "info")
                # Prepare the command for execution
                cmd_list = self._prepare_command(command)
                if cmd_list is None:
                    continue  # skip if preparation failed
                # Execute the command and capture success
                result = self._execute_prepared_command(cmd_list, command)
                if result is None:
                    # _execute_prepared_command returned None if the worker was stopped
                    break
                if result == 0:
                    # Command succeeded; emit success and stop processing
                    self.output_signal.emit(f"Command completed: {command}", "success")
                    success = True
                    break
                else:
                    self.output_signal.emit(f"Command failed: {command}", "warning")
            # Emit the finished signal with overall success status
            self.finished_signal.emit(success)
        except Exception as e:
            # Catch unexpected errors and emit failure
            self.output_signal.emit(f"Build error: {str(e)}", "error")
            self.finished_signal.emit(False)

    def _prepare_command(self, command):
        """
        Prepare a command for execution.  Accepts either a string or list of
        arguments.  Splits strings using shlex, resolves the executable
        component, and checks for existence.  Emits error messages via
        output_signal if the executable cannot be found.  Returns a list of
        command arguments ready for subprocess.Popen, or None if the command
        should be skipped.

        :param command: The command to prepare (string or sequence)
        :return: List of command arguments or None
        """
        # Convert a string into a list of arguments
        if isinstance(command, str):
            cmd_list = shlex.split(command)
        else:
            cmd_list = list(command)
        if not cmd_list:
            return None
        exe = cmd_list[0]
        resolved = _resolve_executable(exe)
        # Check if the resolved executable exists; on Windows also allow .cmd extension
        if shutil.which(resolved) is None and (os.name != "nt" or not resolved.lower().endswith(".cmd")):
            self.output_signal.emit(f"Executable not found: {exe}", "error")
            return None
        # Replace the first element with the resolved executable path
        cmd_list[0] = resolved
        return cmd_list

    def _execute_prepared_command(self, cmd_list, original_command):
        """
        Execute a prepared command list using subprocess.Popen, streaming
        its output lines through output_signal.  Waits for process
        completion unless the worker has been stopped.  Returns the
        process return code on normal completion, None if the worker was
        stopped before completion, or a non-zero return code otherwise.

        :param cmd_list: A list of command arguments to execute
        :param original_command: The original command string (for logging)
        :return: int return code, or None if stopped early
        """
        try:
            process = subprocess.Popen(
                cmd_list,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=self.cwd,
                bufsize=1,
                universal_newlines=True
            )
        except FileNotFoundError as fnf_err:
            # This should rarely occur since we resolved the exe, but handle gracefully
            self.output_signal.emit(f"Executable not found: {cmd_list[0]} ({fnf_err})", "error")
            return 1
        # Read output line by line while running
        while self._is_running:
            line = process.stdout.readline()
            if not line:
                break
            if line.strip():
                self.output_signal.emit(line.strip(), "output")
        # If the worker is still running, wait for completion and return the return code
        if self._is_running:
            process.wait()
            return process.returncode
        else:
            # Worker stopped; terminate process and signal early exit
            try:
                process.terminate()
            except Exception:
                pass
            return None

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
        self.setWindowTitle("🚀 GitHub Release Manager - Modern")
        self.setGeometry(100, 100, 1400, 900)
        
        self.version = "1.0.0"
        self.release_type = "patch"
        self.project_path = ""
        self.is_working = False
        self.is_refreshing = False
        self.current_workers = []
        self.command_queue = Queue()
        self.current_view = "releases"
        self.views = {}
        
        self.setup_ui()
        self.setup_electric_blue_styles()
        
        self.log_signal.connect(self._log_to_console)
        self.update_releases_signal.connect(self.update_releases_display)
        self.reset_refreshing_signal.connect(self._reset_refreshing)
        
        self.queue_timer = QTimer()
        self.queue_timer.timeout.connect(self.process_command_queue)
        self.queue_timer.start(100)
        
        self.setup_all_views()

    def _reset_refreshing(self):
        self.is_refreshing = False

    def setup_electric_blue_styles(self):
        self.setStyleSheet("""
            QMainWindow {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                          stop:0 #0a0a1f, stop:1 #151528);
                color: #ffffff;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            
            QFrame[card="true"] {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #1a1a2e, stop:1 #16162a);
                border-radius: 12px;
                border: 1px solid #2a2a4a;
                padding: 15px;
            }
            
            QFrame[card="true"]:hover {
                border: 1px solid #3a3a5a;
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #202036, stop:1 #1c1c30);
            }
            
            QFrame#sidebar {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                          stop:0 #151528, stop:1 #1a1a2e);
                border-right: 1px solid #2a2a4a;
            }
            
            QLabel {
                color: #e0e0ff;
                padding: 2px;
            }
            
            QLabel.title {
                font-size: 18px;
                font-weight: bold;
                color: #ffffff;
                padding: 8px 0px;
            }
            
            QLabel.subtitle {
                font-size: 12px;
                color: #a0a0c0;
                padding: 2px 0px;
            }
            
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #00a8ff, stop:1 #0097e6);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 12px;
                min-height: 20px;
            }
            
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #0097e6, stop:1 #0087d6);
            }
            
            QPushButton:pressed {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #0087d6, stop:1 #0077c6);
            }
            
            QPushButton:disabled {
                background: #2a2a4a;
                color: #8888aa;
            }
            
            QPushButton.danger {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #ff6b6b, stop:1 #cc5555);
            }
            
            QPushButton.danger:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #ff7b7b, stop:1 #dd6666);
            }
            
            QPushButton.success {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #00d2d3, stop:1 #00b4b5);
            }
            
            QPushButton.success:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #00e3e4, stop:1 #00c4c5);
            }
            
            QPushButton.warning {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #fbc531, stop:1 #e1b12c);
            }
            
            QCheckBox {
                color: #e0e0ff;
                spacing: 12px;
                font-size: 13px;
                padding: 8px 0px;
            }
            
            QCheckBox::indicator {
                width: 20px;
                height: 20px;
                border-radius: 5px;
                border: 2px solid #2a2a4a;
                background: #1a1a2e;
            }
            
            QCheckBox::indicator:checked {
                background: #00a8ff;
                border: 2px solid #00a8ff;
            }
            
            QCheckBox::indicator:checked:hover {
                background: #0097e6;
                border: 2px solid #0097e6;
            }
            
            QCheckBox::indicator:hover {
                border: 2px solid #3a3a5a;
            }
            
            QLineEdit, QTextEdit {
                background: #1a1a2e;
                color: #ffffff;
                border: 2px solid #2a2a4a;
                border-radius: 8px;
                padding: 10px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                selection-background-color: #00a8ff;
            }
            
            QLineEdit:focus, QTextEdit:focus {
                border: 2px solid #00a8ff;
                background: #202036;
            }
            
            QLineEdit::placeholder, QTextEdit::placeholder {
                color: #666699;
            }
            
            QProgressBar {
                border: 2px solid #2a2a4a;
                border-radius: 8px;
                background: #1a1a2e;
                text-align: center;
                color: white;
                font-weight: bold;
            }
            
            QProgressBar::chunk {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                          stop:0 #00a8ff, stop:1 #0097e6);
                border-radius: 6px;
            }
            
            QTabWidget::pane {
                border: 1px solid #2a2a4a;
                background: transparent;
                border-radius: 12px;
            }
            
            QTabBar::tab {
                background: transparent;
                color: transparent;
                padding: 0px;
                border: none;
                margin: 0px;
                font-size: 0px;
            }
            
            QScrollArea {
                border: none;
                background: transparent;
            }
            
            QScrollBar:vertical {
                background: #1a1a2e;
                width: 12px;
                border-radius: 6px;
            }
            
            QScrollBar::handle:vertical {
                background: #00a8ff;
                border-radius: 6px;
                min-height: 20px;
            }
            
            QScrollBar::handle:vertical:hover {
                background: #0097e6;
            }
            
            .ReleaseItem {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #202036, stop:1 #1c1c30);
                border-radius: 10px;
                border: 1px solid #2a2a4a;
                margin: 6px;
                padding: 12px;
            }
            
            .ReleaseItem:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                          stop:0 #252540, stop:1 #202036);
                border: 1px solid #00a8ff;
            }
            
            QGroupBox {
                color: #00a8ff;
                font-weight: bold;
                font-size: 14px;
                border: 2px solid #2a2a4a;
                border-radius: 10px;
                margin-top: 10px;
                padding-top: 10px;
            }
            
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 8px 0 8px;
            }
            
            QStatusBar {
                background: #151528;
                color: #a0a0c0;
                border-top: 1px solid #2a2a4a;
            }
        """)

    def setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        self.create_modern_sidebar(main_layout)
        
        self.create_main_content(main_layout)
        
        self.create_status_bar()

    def setup_all_views(self):
        self.views["releases"] = self.create_releases_view()
        self.views["advanced"] = self.create_advanced_view()
        
        self.show_releases()

    def create_modern_sidebar(self, parent_layout):
        sidebar = QFrame()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(280)
        sidebar.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(15, 20, 15, 20)
        sidebar_layout.setSpacing(20)
        
        title_label = QLabel("🚀 Release Manager")
        title_label.setStyleSheet("font-size: 20px; font-weight: bold; color: #00a8ff; padding: 10px 0px;")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sidebar_layout.addWidget(title_label)
        
        project_card = QFrame()
        project_card.setProperty("card", "true")
        project_layout = QVBoxLayout(project_card)
        project_layout.setSpacing(12)
        
        project_label = QLabel("📁 PROJECT")
        project_label.setStyleSheet("color: #00a8ff; font-size: 14px; font-weight: bold;")
        project_layout.addWidget(project_label)
        
        self.select_path_btn = QPushButton("📂 Select Project Folder")
        self.select_path_btn.clicked.connect(self.browse_project_path)
        self.select_path_btn.setStyleSheet("text-align: left; padding-left: 15px;")
        project_layout.addWidget(self.select_path_btn)
        
        self.path_label = QLabel("No project selected")
        self.path_label.setWordWrap(True)
        self.path_label.setStyleSheet("color: #a0a0c0; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")
        project_layout.addWidget(self.path_label)
        
        version_card = QFrame()
        version_card.setProperty("card", "true")
        version_layout = QVBoxLayout(version_card)
        
        version_title = QLabel("📊 Version Info")
        version_title.setStyleSheet("color: #00a8ff; font-size: 14px; font-weight: bold;")
        version_layout.addWidget(version_title)
        
        version_label = QLabel("Current Version:")
        version_label.setStyleSheet("color: #a0a0c0; font-size: 12px;")
        version_layout.addWidget(version_label)
        
        self.version_display = QLabel("1.0.0")
        self.version_display.setStyleSheet("font-size: 24px; font-weight: bold; color: #00a8ff; padding: 5px 0px;")
        self.version_display.setAlignment(Qt.AlignmentFlag.AlignCenter)
        version_layout.addWidget(self.version_display)
        
        self.project_status = QLabel("⏳ No project selected")
        self.project_status.setStyleSheet("color: #fbc531; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")
        version_layout.addWidget(self.project_status)
        
        project_layout.addWidget(version_card)
        sidebar_layout.addWidget(project_card)
        
        nav_card = QFrame()
        nav_card.setProperty("card", "true")
        nav_layout = QVBoxLayout(nav_card)
        
        nav_label = QLabel("🧭 Navigation")
        nav_label.setStyleSheet("color: #00a8ff; font-size: 14px; font-weight: bold; padding-bottom: 10px;")
        nav_layout.addWidget(nav_label)
        
        nav_buttons = [
            ("📋 View Releases", self.show_releases),
            ("⚙️ Advanced Tools", self.show_advanced),
        ]
        
        for text, command in nav_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            btn.setStyleSheet("text-align: left; padding: 12px 15px; font-size: 13px;")
            nav_layout.addWidget(btn)
        
        sidebar_layout.addWidget(nav_card)
        sidebar_layout.addStretch()
        
        parent_layout.addWidget(sidebar)

    def create_main_content(self, parent_layout):
        main_content = QWidget()
        main_layout = QVBoxLayout(main_content)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)
        
        self.splitter = QSplitter(Qt.Orientation.Vertical)
        self.splitter.setStyleSheet("QSplitter::handle { background: #2a2a4a; }")
        
        self.main_content_stack = QWidget()
        self.main_content_layout = QVBoxLayout(self.main_content_stack)
        self.main_content_layout.setContentsMargins(0, 0, 0, 0)
        
        self.splitter.addWidget(self.main_content_stack)
        
        console_frame = QFrame()
        console_frame.setProperty("card", "true")
        console_layout = QVBoxLayout(console_frame)
        console_layout.setSpacing(10)
        
        console_header = QWidget()
        console_header_layout = QHBoxLayout(console_header)
        console_header_layout.setContentsMargins(0, 0, 0, 0)
        
        console_label = QLabel("📊 Output Console")
        console_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #00a8ff;")
        console_header_layout.addWidget(console_label)
        
        console_header_layout.addStretch()
        
        clear_btn = QPushButton("🗑️ Clear")
        clear_btn.clicked.connect(self.clear_console)
        clear_btn.setFixedWidth(100)
        console_header_layout.addWidget(clear_btn)
        
        copy_btn = QPushButton("📋 Copy")
        copy_btn.clicked.connect(self.copy_console)
        copy_btn.setFixedWidth(100)
        console_header_layout.addWidget(copy_btn)
        
        stop_btn = QPushButton("⏹️ Stop")
        stop_btn.clicked.connect(self.stop_all_commands)
        stop_btn.setStyleSheet("background-color: #ff6b6b;")
        stop_btn.setFixedWidth(100)
        console_header_layout.addWidget(stop_btn)
        
        console_layout.addWidget(console_header)
        
        self.console_text = QTextEdit()
        self.console_text.setFont(QFont("Consolas", 11))
        self.console_text.setReadOnly(True)
        self.console_text.setMinimumHeight(250)
        console_layout.addWidget(self.console_text)
        
        self.splitter.addWidget(console_frame)
        
        self.splitter.setStretchFactor(0, 55)
        self.splitter.setStretchFactor(1, 45)
        self.splitter.setSizes([500, 400])
        
        main_layout.addWidget(self.splitter)
        parent_layout.addWidget(main_content, 1)

    def create_status_bar(self):
        self.status_bar = self.statusBar()
        self.status_bar.showMessage("✅ Ready")
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setMaximumWidth(250)
        self.progress_bar.setVisible(False)
        self.status_bar.addPermanentWidget(self.progress_bar)

    def create_releases_view(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(15)
        
        header = QWidget()
        header_layout = QHBoxLayout(header)
        
        title = QLabel("📋 Release History")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: #00a8ff;")
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        refresh_btn = QPushButton("🔄 Refresh")
        refresh_btn.clicked.connect(self.refresh_releases)
        refresh_btn.setFixedWidth(120)
        header_layout.addWidget(refresh_btn)
        
        layout.addWidget(header)
        
        releases_card = QFrame()
        releases_card.setProperty("card", "true")
        releases_layout = QVBoxLayout(releases_card)
        releases_layout.setSpacing(10)
        
        stats_widget = QWidget()
        stats_layout = QHBoxLayout(stats_widget)
        stats_layout.setContentsMargins(0, 0, 0, 0)
        
        self.releases_count_label = QLabel("Releases: 0")
        self.releases_count_label.setStyleSheet("color: #00a8ff; font-weight: bold;")
        stats_layout.addWidget(self.releases_count_label)
        
        self.tags_count_label = QLabel("Tags: 0")
        self.tags_count_label.setStyleSheet("color: #fbc531; font-weight: bold;")
        stats_layout.addWidget(self.tags_count_label)
        
        stats_layout.addStretch()
        
        self.last_update_label = QLabel("Last update: Never")
        self.last_update_label.setStyleSheet("color: #8888aa; font-size: 11px;")
        stats_layout.addWidget(self.last_update_label)
        
        releases_layout.addWidget(stats_widget)
        
        self.releases_scroll = QScrollArea()
        self.releases_scroll.setWidgetResizable(True)
        self.releases_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.releases_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.releases_scroll.setStyleSheet("""
            QScrollArea {
                background: transparent;
                border: none;
                border-radius: 8px;
            }
            QScrollArea > QWidget > QWidget {
                background: transparent;
            }
        """)
        
        self.releases_container = QWidget()
        self.releases_container.setStyleSheet("background: transparent;")
        self.releases_layout = QVBoxLayout(self.releases_container)
        self.releases_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.releases_layout.setSpacing(8)
        self.releases_layout.setContentsMargins(5, 5, 5, 5)
        
        self.setup_initial_placeholder()
        
        self.releases_scroll.setWidget(self.releases_container)
        releases_layout.addWidget(self.releases_scroll, 1)
        
        layout.addWidget(releases_card, 1)
        
        return widget

    def create_advanced_view(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(15, 15, 15, 15)
        layout.setSpacing(15)
        
        grid_widget = QWidget()
        grid_layout = QGridLayout(grid_widget)
        grid_layout.setSpacing(15)
        grid_layout.setHorizontalSpacing(30)
        
        details_group = QGroupBox("📝 Release Details")
        details_group.setMinimumHeight(400)
        details_layout = QVBoxLayout(details_group)
        details_layout.setSpacing(10)
        
        version_widget = QWidget()
        version_layout = QHBoxLayout(version_widget)
        version_layout.setContentsMargins(0, 0, 0, 0)
        
        version_label = QLabel("Version:")
        version_label.setFixedWidth(80)
        version_label.setStyleSheet("color: #e0e0ff;")
        version_layout.addWidget(version_label)
        
        self.version_entry = QLineEdit()
        self.version_entry.setPlaceholderText("e.g., 1.2.3")
        version_layout.addWidget(self.version_entry)
        
        suggest_btn = QPushButton("💡 Suggest")
        suggest_btn.clicked.connect(self.suggest_version)
        suggest_btn.setFixedWidth(100)
        suggest_btn.setStyleSheet("font-size: 11px; padding: 8px 5px;")
        version_layout.addWidget(suggest_btn)
        
        details_layout.addWidget(version_widget)
        
        title_widget = QWidget()
        title_layout = QHBoxLayout(title_widget)
        title_layout.setContentsMargins(0, 0, 0, 0)
        
        title_label = QLabel("Title:")
        title_label.setFixedWidth(80)
        title_label.setStyleSheet("color: #e0e0ff;")
        title_layout.addWidget(title_label)
        
        self.title_entry = QLineEdit()
        self.title_entry.setPlaceholderText("Auto-generated if empty")
        title_layout.addWidget(self.title_entry)
        
        details_layout.addWidget(title_widget)
        
        notes_container = QWidget()
        notes_container_layout = QVBoxLayout(notes_container)
        notes_container_layout.setContentsMargins(0, 0, 0, 0)
        notes_container_layout.setSpacing(5)

        notes_label = QLabel("Release Notes:")
        notes_label.setStyleSheet("color: #e0e0ff;")
        notes_container_layout.addWidget(notes_label)

        self.notes_text = QTextEdit()
        self.notes_text.setMinimumHeight(200)
        self.notes_text.setPlaceholderText("Enter release notes...")
        notes_container_layout.addWidget(self.notes_text)

        preview_container = QWidget()
        preview_container_layout = QVBoxLayout(preview_container)
        preview_container_layout.setContentsMargins(0, 0, 0, 0)
        preview_container_layout.setSpacing(5)

        preview_label = QLabel("Preview:")
        preview_label.setStyleSheet("color: #e0e0ff;")
        preview_container_layout.addWidget(preview_label)

        self.preview_browser = QTextBrowser()
        self.preview_browser.setMinimumHeight(200)
        self.preview_browser.setReadOnly(True)
        preview_container_layout.addWidget(self.preview_browser)

        notes_preview_layout = QHBoxLayout()
        notes_preview_layout.setContentsMargins(0, 0, 0, 0)
        notes_preview_layout.setSpacing(10)
        notes_preview_layout.addWidget(notes_container)
        notes_preview_layout.addWidget(preview_container)
        notes_preview_layout.setStretch(0, 1)
        notes_preview_layout.setStretch(1, 1)

        details_layout.addLayout(notes_preview_layout)

        self.notes_text.textChanged.connect(self.update_markdown_preview)
        
        grid_layout.addWidget(details_group, 0, 0)

        grid_layout.setColumnStretch(0, 3)
        grid_layout.setColumnStretch(1, 1)

        actions_group = QGroupBox("🔨🚀 Actions")
        actions_group.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        actions_layout = QVBoxLayout(actions_group)
        actions_layout.setContentsMargins(15, 15, 15, 15)
        actions_layout.setSpacing(6)
        actions_group.setMaximumWidth(180)
        
        action_buttons = [
            ("🔧 Build Project", lambda: self.queue_command(self.safe_build_single)),
            ("📦 Create Release", self.create_release),
        ]
        
        for text, command in action_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            btn.setFixedHeight(30)
            btn.setFixedWidth(150)
            actions_layout.addWidget(btn)

        
        grid_layout.addWidget(actions_group, 0, 1)

        layout.addWidget(grid_widget, 1)
        layout.addStretch()
        
        return widget

    def setup_initial_placeholder(self):
        if hasattr(self, 'placeholder_label') and self.placeholder_label:
            try:
                self.releases_layout.removeWidget(self.placeholder_label)
                self.placeholder_label.deleteLater()
            except Exception as e:
                self.log(f"Error removing placeholder: {e}", "warning")
            self.placeholder_label = None
        
        if not self.project_path:
            self.placeholder_label = QLabel()
            self.placeholder_label.setTextFormat(Qt.TextFormat.RichText)
            self.placeholder_label.setText("""
            <div style="text-align: center; padding: 40px 20px;">
                <h3 style="color: #00a8ff; margin-bottom: 25px; font-size: 20px; font-weight: bold;">GitHub Release Manager</h3>
                
                <div style="display: inline-block; text-align: left; max-width: 500px;">
                    <div style="margin-bottom: 20px;">
                        <div style="color: #00a8ff; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                            1. Select Project Folder
                        </div>
                        <div style="color: #a0a0c0; font-size: 12px; line-height: 1.4; padding-left: 8px;">
                            Click <span style="color: #00a8ff; font-weight: bold;">"Select Project Folder"</span> in the sidebar to choose your project directory
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="color: #00d2d3; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                            2. Install & Authenticate GitHub CLI
                        </div>
                        <div style="color: #a0a0c0; font-size: 12px; line-height: 1.4; padding-left: 8px;">
                            • Install from: <span style="color: #00d2d3;">https://cli.github.com/</span><br>
                            • Run: <code style="color: #00d2d3; font-family: monospace;">gh auth login</code> to authenticate
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <div style="color: #9c88ff; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                            3. Start Managing Releases
                        </div>
                        <div style="color: #a0a0c0; font-size: 12px; line-height: 1.4; padding-left: 8px;">
                            Once setup is complete, click <span style="color: #9c88ff; font-weight: bold;">"Refresh"</span> to load your releases
                        </div>
                    </div>
                </div>
                
                <div style="color: #8888aa; font-size: 11px; margin-top: 20px;">
                    Need help? Check the GitHub CLI documentation for detailed setup instructions
                </div>
            </div>
            """)
            self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.placeholder_label.setWordWrap(True)
            self.releases_layout.addWidget(self.placeholder_label)
        else:
            self.placeholder_label = None

    def switch_view(self, view_name):
        self.clear_main_content()
        if view_name in self.views:
            self.main_content_layout.addWidget(self.views[view_name])

    def clear_main_content(self):
        while self.main_content_layout.count():
            child = self.main_content_layout.takeAt(0)
            if child.widget():
                child.widget().setParent(None)

    def suggest_version(self):
        if not self.version:
            self.log("No current version found", "error")
            return
            
        current_version = self.version
        suggested_version = self.calculate_new_version(current_version, self.release_type)
        self.log(f"Suggested version: {suggested_version}", "info")
        self.version_entry.setText(suggested_version)

    def queue_command(self, command_func):
        self.command_queue.put(command_func)
        self.log(f"Queued: {command_func.__name__}", "info")

    def process_command_queue(self):
        try:
            if not self.is_working and not self.command_queue.empty():
                command_func = self.command_queue.get_nowait()
                self.log(f"Executing: {command_func.__name__}", "info")
                QTimer.singleShot(0, command_func)
        except Empty:
            return

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
        self.log("All commands stopped", "warning")

    def show_releases(self):
        self.current_view = "releases"
        self.switch_view("releases")
        self.refresh_releases()

    def show_advanced(self):
        self.current_view = "advanced"
        self.switch_view("advanced")

    def check_project_selected(self):
        if not self.project_path:
            self.log("Select project path first", "error")
            return False
        
        project_path = Path(self.project_path)
        if not project_path.exists():
            self.log("Project path does not exist", "error")
            return False
            
        package_json = project_path / "package.json"
        if not package_json.exists():
            self.log("package.json not found", "error")
            return False
            
        return True

    def check_git_repository(self):
        if not self.check_project_selected():
            return False
            
        project_path = Path(self.project_path)
        git_dir = project_path / ".git"
        
        if not git_dir.exists():
            self.log("Not a git repository", "error")
            return False
            
        return True

    def check_dist_files_exist(self):
        if not self.check_project_selected():
            return False
            
        dist_path = Path(self.project_path) / "dist"
        
        if not dist_path.exists():
            self.log("dist folder does not exist", "error")
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
                self.project_status.setText("✅ Ready (Git)")
                self.project_status.setStyleSheet("color: #00d2d3; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")
            else:
                self.project_status.setText("⚠️ Ready (No Git)")
                self.project_status.setStyleSheet("color: #fbc531; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")
        else:
            self.project_status.setText("❌ No project")
            self.project_status.setStyleSheet("color: #ff6b6b; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")

    def kill_electron_only(self):
        self.log("Killing Electron processes...", "warning")
        electron_processes = ["electron.exe", "MakeYourLifeEasier.exe", "node.exe"]
        killed_count = 0
        
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                proc_name = proc.info['name'].lower()
                if any(target in proc_name for target in electron_processes):
                    proc.kill()
                    killed_count += 1
                    self.log(f"Killed: {proc.info['name']}", "warning")
            except Exception as e:
                self.log(f"Error killing process {proc.info.get('name', '')}: {e}", "warning")
        
        QTimer.singleShot(100, lambda: self.log(f"Killed {killed_count} processes", "success"))

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
                self.log(f"Delete failed: {str(e)}", "warning")
                QApplication.processEvents()
                time.sleep(0.1)
        return False

    def get_available_build_commands(self):
        package_json_path = Path(self.project_path) / "package.json"
        available_commands = []
        
        if package_json_path.exists():
            try:
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    scripts = json.load(f).get('scripts', {})
                    
                priority_commands = [
                    "npm run build-all",
                    "npm run build-portable", 
                    "npm run build-installer",
                    "npm run build",
                    "npm run dist",
                    "npm run electron:build",
                    "npx electron-builder",
                    "npm run make"
                ]
                
                for cmd in priority_commands:
                    script_name = cmd.replace("npm run ", "").replace("npx ", "")
                    if cmd.startswith("npm run ") and script_name in scripts:
                        available_commands.append(cmd)
                    elif cmd.startswith("npx "):
                        available_commands.append(cmd)
                        
            except Exception as e:
                self.log(f"Error reading package.json: {e}", "error")
        
        return available_commands

    def safe_build_single(self):
        if not self.check_project_selected():
            return False
            
        self.log("Starting safe build process...", "info")
        
        self.kill_electron_only()
        
        if not self.safe_delete_dist():
            self.log("Failed to clean dist folder", "error")
            return False
            
        build_commands = self.get_available_build_commands()
        
        if not build_commands:
            self.log("No build commands found in package.json", "error")
            return False
        
        self.log(f"Trying {len(build_commands)} build commands...", "info")
        
        self.is_working = True
        self.progress_bar.setVisible(True)
        self.update_status("Building project...")
        
        self.build_worker = BuildWorker(build_commands, self.project_path)
        self.build_worker.output_signal.connect(lambda msg, typ: self.log(msg, typ))
        self.build_worker.finished_signal.connect(self.build_finished)
        self.build_worker.progress_signal.connect(lambda msg: self.update_status(msg))
        
        self.build_worker.start()
        return True

    def build_finished(self, success):
        self.is_working = False
        self.progress_bar.setVisible(False)
        
        if success:
            self.log("Build completed successfully", "success")
            self.update_status("Build completed")
            
            def check_dist_files():
                if self.check_dist_files_exist():
                    self.log("Distribution files created successfully", "success")
                else:
                    self.log("Build completed but distribution files not found", "warning")
            QTimer.singleShot(2000, check_dist_files)
        else:
            self.log("Build failed", "error")
            self.update_status("Build failed")
        
        if hasattr(self, 'build_worker'):
            self.build_worker = None

    def _run_subprocess(self, command):
        try:
            if isinstance(command, str):
                cmd_list = shlex.split(command)
            else:
                cmd_list = command
            if cmd_list:
                resolved = _resolve_executable(cmd_list[0])
                cmd_list[0] = resolved
            process = subprocess.run(cmd_list, capture_output=True, text=True, cwd=self.project_path, timeout=600)
            output = process.stdout + process.stderr
            tag = "output" if process.returncode == 0 else "error"
            self.log(output, tag)
            if process.returncode == 0:
                self.log("Command success", "success")
            else:
                self.log(f"Command failed: {process.returncode}", "error")
            return process.returncode == 0
        except Exception as e:
            self.log(f"Error: {str(e)}", "error")
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
        if require_project and not self.check_project_selected():
            return False
            
        if check_git and not self.check_git_repository():
            return False
            
        try:
            self.log(f"{command}", "info")
            if isinstance(command, str):
                cmd_list = shlex.split(command)
            else:
                cmd_list = command
            if cmd_list:
                resolved = _resolve_executable(cmd_list[0])
                cmd_list[0] = resolved
            process = subprocess.run(cmd_list, capture_output=True, text=True,
                                   cwd=cwd or self.project_path, timeout=300)
            output = process.stdout + process.stderr
            if process.returncode == 0:
                self.log(output, "output")
                self.log("Command completed successfully", "success")
                return True
            else:
                self.log(output, "error")
                self.log(f"Command failed: {process.returncode}", "error")
                return False
        except Exception as e:
            self.log(f"Error: {str(e)}", "error")
            return False

    def create_release(self):
        if not self.check_git_repository() or not self.check_dist_files_exist():
            self.log("Checks failed", "error")
            return
        
        new_version = self.version_entry.text().strip()
        
        if not new_version:
            self.log("Please enter a version number", "error")
            return
        
        import re
        if not re.match(r'^\d+\.\d+\.\d+$', new_version):
            self.log("Version format should be X.Y.Z (e.g., 1.2.3)", "error")
            return
        
        release_title = self.title_entry.text().strip() or f"v{new_version}"
        release_notes = self.notes_text.toPlainText().strip() or f"Release v{new_version}"
        
        self.log(f"Release Details:", "info")
        self.log(f"   Version: {new_version}", "info")
        self.log(f"   Title: {release_title}", "info")
        self.log(f"   Notes: {release_notes[:100]}...", "info")
        
        temp_notes_file = Path(self.project_path) / f"release_notes_{new_version}.md"
        
        try:
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            self.log(f"Notes written to: {temp_notes_file}", "info")
            
            if temp_notes_file.exists():
                file_size = temp_notes_file.stat().st_size
                self.log(f"Notes file size: {file_size} bytes", "info")
            
            def create_release_sync():
                try:
                    create_command = [
                        'gh', 'release', 'create', f'v{new_version}',
                        './dist/MakeYourLifeEasier-*.exe',
                        './dist/latest.yml',
                        './dist/*.blockmap',
                        '--title', release_title,
                        '--notes-file', str(temp_notes_file)
                    ]
                    
                    self.log(f"Executing: {' '.join(create_command)}", "info")
                    
                    result = subprocess.run(
                        create_command,
                        cwd=self.project_path,
                        capture_output=True,
                        text=True,
                        timeout=120
                    )
                    
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    
                    if result.returncode == 0:
                        self.log(f"Release v{new_version} created successfully!", "success")
                        self.update_version_display(new_version)
                        QTimer.singleShot(3000, self.refresh_releases)
                    else:
                        error_msg = result.stderr if result.stderr else "Unknown error"
                        self.log(f"Failed to create release: {error_msg}", "error")
                        
                except subprocess.TimeoutExpired:
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    self.log("Timeout creating release", "error")
                except Exception as e:
                    if temp_notes_file.exists():
                        temp_notes_file.unlink()
                    self.log(f"Error creating release: {e}", "error")
            
            threading.Thread(target=create_release_sync, daemon=True).start()
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"Error preparing release: {e}", "error")

    def update_version_display(self, new_version):
        self.version = new_version
        self.version_display.setText(new_version)
        self.version_entry.clear()

    def calculate_new_version(self, current_version, release_type):
        try:
            major, minor, patch = map(int, current_version.split('.'))
            if release_type == "patch":
                patch += 1
            elif release_type == "minor":
                minor += 1
                patch = 0
            elif release_type == "major":
                major += 1
                minor = 0
                patch = 0
            return f"{major}.{minor}.{patch}"
        except Exception:
            return "1.0.0"

    def update_release(self):
        if not self.check_git_repository() or not self.check_dist_files_exist():
            self.log("Checks failed", "error")
            return
        
        latest_tag = self.get_latest_release_tag()
        if not latest_tag:
            self.log("No releases found on GitHub", "error")
            return
        
        version = latest_tag.lstrip('v')
        
        release_title = self.title_entry.text().strip()
        release_notes = self.notes_text.toPlainText().strip()
        
        if not release_title or not release_notes:
            self.log("Enter title and notes", "error")
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
                except Exception as e:
                    self.log(f"Error deleting temporary notes file: {e}", "warning")
                
                if success:
                    self.log("Release updated", "success")
                    self.refresh_releases()
                else:
                    self.log("Failed to update release", "error")
            
            self.run_command_async(edit_command, callback=edit_callback)
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"Error: {str(e)}", "error")

    def delete_current_tag(self):
        if not self.check_git_repository():
            return
        
        latest_tag = self.get_latest_release_tag()
        if not latest_tag:
            self.log("No releases found", "error")
            return
        
        reply = QMessageBox.question(self, "Confirm Delete", 
                                   f"Delete release {latest_tag}? This cannot be undone!",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        self.log(f"Deleting release {latest_tag}...", "warning")
        
        def delete_operations():
            try:
                delete_release_cmd = f"gh release delete {latest_tag} --yes"
                if self.run_command_sync(delete_release_cmd):
                    self.log(f"Release {latest_tag} deleted", "success")
                    
                    delete_local_tag_cmd = f"git tag -d {latest_tag}"
                    self.run_command_sync(delete_local_tag_cmd)
                    
                    delete_remote_tag_cmd = f"git push origin --delete {latest_tag}"
                    self.run_command_sync(delete_remote_tag_cmd)
                    
                    QTimer.singleShot(0, self.refresh_releases)
                else:
                    self.log(f"Failed to delete release {latest_tag}", "error")
            except Exception as e:
                self.log(f"Error deleting: {e}", "error")
        
        threading.Thread(target=delete_operations, daemon=True).start()

    def get_latest_release_tag(self):
        try:
            result = subprocess.run(
                [GH_EXECUTABLE, "release", "list", "--limit", "1", "--json", "tagName"],
                capture_output=True, text=True, cwd=self.project_path
            )
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data:
                    return data[0]['tagName']
            return None
        except Exception:
            return None

    def refresh_releases(self):
        if not self.check_git_repository():
            return
        
        if self.current_view != "releases":
            self.log("Not in releases view, skipping refresh", "info")
            return
        
        if self.is_refreshing:
            self.log("Already refreshing, skipping...", "info")
            return
        
        self.is_refreshing = True
        self.log("Refreshing releases...", "info")
        
        def fetch_releases():
            releases = []
            all_tags = []
            try:
                self.log("Running gh release list command", "info")
                result = subprocess.run(
                    [GH_EXECUTABLE, "release", "list", "--limit", "50", "--json", "tagName,name,createdAt,isDraft,isPrerelease,publishedAt"],
                    capture_output=True, text=True, cwd=self.project_path, timeout=30
                )
                
                self.log(f"gh command returncode: {result.returncode}", "info")
                if result.returncode == 0:
                    stdout = result.stdout.strip()
                    self.log(f"gh stdout: {stdout[:100]}...", "output")
                    if stdout:
                        try:
                            releases = json.loads(stdout)
                            releases = sorted(releases, key=lambda x: x['createdAt'], reverse=True)
                            self.log(f"Found {len(releases)} releases via GitHub CLI", "success")
                        except json.JSONDecodeError as e:
                            self.log(f"JSON parse error: {e}", "error")
                    else:
                        self.log("Empty output from gh release list", "warning")
                else:
                    self.log(f"gh release list failed with code {result.returncode}", "error")
                    self.log(f"Error: {result.stderr}", "error")
                    self.log("No releases found via GitHub CLI", "warning")
                
                self.log("Running git tag command", "info")
                tags_result = subprocess.run(
                    [GIT_EXECUTABLE, "tag", "--list", "--sort=-creatordate"],
                    capture_output=True, text=True, cwd=self.project_path, timeout=30
                )
                
                self.log(f"git tag returncode: {tags_result.returncode}", "info")
                if tags_result.returncode == 0:
                    stdout = tags_result.stdout.strip()
                    self.log(f"git stdout: {stdout[:100]}...", "output")
                    if stdout:
                        all_tags = [tag.strip() for tag in stdout.split('\n') if tag.strip()]
                        self.log(f"Found {len(all_tags)} git tags", "success")
                    else:
                        self.log("No git tags found", "warning")
                else:
                    self.log(f"git tag failed with code {tags_result.returncode}", "error")
                    self.log(f"Error: {tags_result.stderr}", "error")
                
                if self.current_view == "releases":
                    self.update_releases_signal.emit(releases, all_tags)
                else:
                    self.log("View changed during refresh, skipping UI update", "info")
                    
            except subprocess.TimeoutExpired:
                self.log("Timeout fetching releases", "error")
            except Exception as e:
                self.log(f"Error fetching releases: {e}", "error")
            finally:
                self.reset_refreshing_signal.emit()

        threading.Thread(target=fetch_releases, daemon=True).start()

    def update_releases_display(self, releases, all_tags):
        QTimer.singleShot(0, lambda: self._safe_update_releases_display(releases, all_tags))

    def _safe_update_releases_display(self, releases, all_tags):
        try:
            # Abort if we are not in the releases view or the layout is missing
            if not self._can_update_releases_display():
                return
            # Start fresh by clearing the existing layout
            self.clear_releases_layout()
            # Update counts and timestamp labels
            self._update_release_counts(releases, all_tags)
            # Handle case where there are no releases or tags
            if not releases and not all_tags:
                self._show_no_releases_placeholder()
                return
            # Hide any existing placeholder when data exists
            self._hide_placeholder_label()
            # Build a set of tag names from the releases list
            release_tags = {release['tagName'] for release in releases}
            # Add releases section if applicable
            if releases:
                self._add_releases_section(releases)
            # Determine tags that have no associated release
            tags_without_releases = [tag for tag in all_tags if tag not in release_tags]
            # Add tags section if there are tags without releases
            if tags_without_releases:
                self._add_tags_section(tags_without_releases)
            # Add stretch at the end to push items to the top
            self.releases_layout.addStretch()
        except RuntimeError:
            return
        except Exception as e:
            print(f"Unexpected error updating releases display: {e}")

    def _can_update_releases_display(self):
        """
        Determine whether the releases display should be updated based on
        current view and layout availability.  Logs informative messages
        when updates are skipped.
        :return: bool True if update should proceed, False otherwise
        """
        if self.current_view != "releases":
            self.log("Not in releases view, skipping UI update", "info")
            return False
        if not self.releases_container or not self.releases_layout:
            self.log("Releases layout no longer exists, skipping update", "warning")
            return False
        return True

    def _update_release_counts(self, releases, all_tags):
        """
        Update the releases and tags count labels as well as the last update
        timestamp.  Encapsulating this logic reduces complexity in the
        calling method.
        :param releases: list of release objects
        :param all_tags: list of all tag names
        """
        releases_count = len(releases)
        tags_count = len(all_tags)
        self.releases_count_label.setText(f"📦 Releases: {releases_count}")
        self.tags_count_label.setText(f"🏷️ Tags: {tags_count}")
        current_time = datetime.now().strftime("%H:%M:%S")
        self.last_update_label.setText(f"Last update: {current_time}")

    def _show_no_releases_placeholder(self):
        """
        Display a placeholder label when no releases or tags are found.
        Behaviour differs depending on whether a project path has been set.
        """
        # When no project path is selected, show the initial placeholder
        if not self.project_path:
            if not hasattr(self, 'placeholder_label') or not self.placeholder_label:
                self.setup_initial_placeholder()
            else:
                self.placeholder_label.show()
            return
        # With a project path selected, ensure a detailed placeholder exists
        if not hasattr(self, 'placeholder_label') or not self.placeholder_label:
            self.placeholder_label = QLabel()
            self.placeholder_label.setTextFormat(Qt.TextFormat.RichText)
            self.placeholder_label.setText(
                """
                <div style="text-align: center; padding: 40px;">
                    <h3 style="color: #fbc531; margin-bottom: 15px;">🔍 No Releases Found</h3>
                    <p style="color: #a0a0c0; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
                        No GitHub releases or tags found for this repository.
                    </p>
                    <div style="background: #fbc53120; padding: 15px; border-radius: 8px; border: 1px solid #fbc53140; margin: 0 auto; max-width: 450px;">
                        <p style="color: #e0e0ff; margin-bottom: 10px; font-size: 13px; text-align: left;">
                            <span style="color: #fbc531;">•</span> Make sure GitHub CLI is installed and authenticated
                        </p>
                        <p style="color: #e0e0ff; margin-bottom: 10px; font-size: 13px; text-align: left;">
                            <span style="color: #fbc531;">•</span> Verify you have access to the repository
                        </p>
                        <p style="color: #e0e0ff; margin-bottom: 0; font-size: 13px; text-align: left;">
                            <span style="color: #fbc531;">•</span> Check if repository has any releases or tags
                        </p>
                    </div>
                </div>
                """
            )
            self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.placeholder_label.setWordWrap(True)
            self.releases_layout.addWidget(self.placeholder_label)
        else:
            self.placeholder_label.show()

    def _hide_placeholder_label(self):
        """
        Hide the placeholder label if it exists.  Avoids residual placeholder
        when releases or tags data is present.
        """
        if hasattr(self, 'placeholder_label') and self.placeholder_label:
            self.placeholder_label.hide()

    def _add_releases_section(self, releases):
        """
        Add a header and list of release items to the releases layout.  This
        method encapsulates the creation of the releases header and
        iteration over release objects.
        :param releases: list of release objects
        """
        releases_header = QLabel("🚀 GitHub Releases")
        releases_header.setStyleSheet(
            """
            font-size: 16px;
            font-weight: bold;
            color: #00a8ff;
            margin-top: 10px;
            margin-bottom: 10px;
            padding: 8px;
            background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                        stop:0 transparent, stop:0.5 #00a8ff20, stop:1 transparent);
            border-radius: 6px;
            """
        )
        releases_header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.releases_layout.addWidget(releases_header)
        for release in releases:
            self.add_release_item(release, is_release=True)

    def _add_tags_section(self, tags_without_releases):
        """
        Add a header and list of tag items (without releases) to the releases
        layout.  Each tag is converted into a dictionary matching the
        expected format of add_release_item.
        :param tags_without_releases: list of tag names
        """
        tags_header = QLabel("🏷️ Git Tags (No Release)")
        tags_header.setStyleSheet(
            """
            font-size: 16px;
            font-weight: bold;
            color: #fbc531;
            margin-top: 20px;
            margin-bottom: 10px;
            padding: 8px;
            background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                        stop:0 transparent, stop:0.5 #fbc53120, stop:1 transparent);
            border-radius: 6px;
            """
        )
        tags_header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.releases_layout.addWidget(tags_header)
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
        try:
            if not self.releases_layout:
                return
            
            items_to_remove = []
            
            for i in range(self.releases_layout.count()):
                child = self.releases_layout.itemAt(i)
                if child:
                    if child.widget() and child.widget() == self.placeholder_label:
                        continue
                    
                    items_to_remove.append(child)
            
            for item in items_to_remove:
                try:
                    if item.widget():
                        widget = item.widget()
                        self.releases_layout.removeWidget(widget)
                        widget.setParent(None)
                        widget.deleteLater()
                    else:
                        self.releases_layout.removeItem(item)
                except Exception as e:
                    print(f"Error removing item: {e}")
                    
        except Exception as e:
            print(f"Error in clear_releases_layout: {e}")

    def add_release_item(self, release, is_release=True):
        item_frame = QFrame()
        item_frame.setObjectName("ReleaseItem")
        item_frame.setStyleSheet("""
            QFrame#ReleaseItem {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                        stop:0 #202036, stop:1 #1c1c30);
                border-radius: 12px;
                border: 1px solid #2a2a4a;
                margin: 6px;
                padding: 15px;
            }
            QFrame#ReleaseItem:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                        stop:0 #252540, stop:1 #202036);
                border: 1px solid #00a8ff;
            }
        """)
        
        item_layout = QHBoxLayout(item_frame)
        item_layout.setContentsMargins(15, 12, 15, 12)
        item_layout.setSpacing(12)
        
        info_layout = QVBoxLayout()
        info_layout.setSpacing(6)
        
        title = release.get('name', release['tagName'])
        title_label = QLabel(f"{'🚀' if is_release else '🏷️'} {title}")
        title_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        title_label.setStyleSheet("color: #ffffff;")
        title_label.setWordWrap(True)
        info_layout.addWidget(title_label)
        
        meta_layout = QHBoxLayout()
        
        tag_label = QLabel(f"📌 {release['tagName']}")
        tag_label.setStyleSheet("color: #00a8ff; font-size: 10px; font-weight: bold; background: #00a8ff20; padding: 2px 8px; border-radius: 10px;")
        meta_layout.addWidget(tag_label)
        
        date_str = ""
        if is_release:
            date_value = release.get('publishedAt') or release.get('createdAt', '')
            if date_value:
                try:
                    date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                    date_str = date_obj.strftime('%Y-%m-%d %H:%M')
                except ValueError:
                    date_str = date_value.split('T')[0]
        
        if date_str:
            date_label = QLabel(f"📅 {date_str}")
            date_label.setStyleSheet("color: #8888aa; font-size: 10px;")
            meta_layout.addWidget(date_label)
        
        if not is_release:
            git_tag_label = QLabel("🔖 Git Tag Only")
            git_tag_label.setStyleSheet("color: #fbc531; font-size: 10px; background: #fbc53120; padding: 2px 8px; border-radius: 10px;")
            meta_layout.addWidget(git_tag_label)
        
        meta_layout.addStretch()
        info_layout.addLayout(meta_layout)
        
        item_layout.addLayout(info_layout, 1)
        
        right_layout = QVBoxLayout()
        right_layout.setSpacing(6)
        right_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        
        badges_layout = QHBoxLayout()
        badges_layout.setSpacing(6)
        
        if is_release:
            if release.get('isDraft'):
                draft_label = QLabel("📝 DRAFT")
                draft_label.setStyleSheet("""
                    QLabel {
                        background-color: #fbc531; 
                        color: #000000; 
                        padding: 3px 8px; 
                        border-radius: 8px; 
                        font-size: 9px;
                        font-weight: bold;
                    }
                """)
                badges_layout.addWidget(draft_label)
            
            if release.get('isPrerelease'):
                pre_label = QLabel("🔬 PRE-RELEASE")
                pre_label.setStyleSheet("""
                    QLabel {
                        background-color: #9c88ff; 
                        color: white; 
                        padding: 3px 8px; 
                        border-radius: 8px; 
                        font-size: 9px;
                        font-weight: bold;
                    }
                """)
                badges_layout.addWidget(pre_label)
        
        badges_layout.addStretch()
        right_layout.addLayout(badges_layout)
        
        delete_btn = QPushButton("🗑️ Delete")
        delete_btn.setFixedSize(80, 28)
        delete_btn.setToolTip(f"Delete {release['tagName']}")
        delete_btn.setStyleSheet("""
            QPushButton {
                background-color: #ff6b6b;
                border-radius: 6px;
                font-size: 10px;
                font-weight: bold;
                padding: 4px 8px;
            }
            QPushButton:hover {
                background-color: #c0392b;
            }
        """)
        delete_btn.clicked.connect(lambda checked, tag=release['tagName'], is_rel=is_release: 
                                self.delete_release_tag(tag, is_rel))
        right_layout.addWidget(delete_btn)
        
        item_layout.addLayout(right_layout)
        
        self.releases_layout.addWidget(item_frame)

    def delete_release_tag(self, tag_name, is_release=True):
        reply = QMessageBox.question(
            self, 
            "Confirm Delete", 
            f"Delete {'release' if is_release else 'tag'} {tag_name}?\n\nThis action cannot be undone!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        self.log(f"Deleting {'release' if is_release else 'tag'} {tag_name}...", "warning")
        
        def delete_operations():
            try:
                success = True
                
                if is_release:
                    delete_release_cmd = [GH_EXECUTABLE, "release", "delete", tag_name, "--yes"]
                    result = subprocess.run(delete_release_cmd, capture_output=True, text=True, 
                                          cwd=self.project_path, timeout=30)
                    
                    if result.returncode == 0:
                        self.log(f"GitHub release {tag_name} deleted", "success")
                    else:
                        self.log(f"Could not delete GitHub release (may not exist): {result.stderr}", "warning")
                
                delete_local_cmd = [GIT_EXECUTABLE, "tag", "-d", tag_name]
                local_result = subprocess.run(delete_local_cmd, capture_output=True, text=True,
                                            cwd=self.project_path, timeout=30)
                
                if local_result.returncode == 0:
                    self.log(f"Local tag {tag_name} deleted", "success")
                else:
                    if "tag '{tag_name}' not found" in local_result.stderr:
                        self.log(f"No local tag {tag_name} to delete", "info")
                    else:
                        self.log(f"Could not delete local tag: {local_result.stderr}", "warning")
                        success = False
                
                delete_remote_cmd = [GIT_EXECUTABLE, "push", "origin", "--delete", tag_name]
                remote_result = subprocess.run(delete_remote_cmd, capture_output=True, text=True,
                                             cwd=self.project_path, timeout=30)
                
                if remote_result.returncode == 0:
                    self.log(f"Remote tag {tag_name} deleted", "success")
                else:
                    if "remote ref does not exist" in remote_result.stderr:
                        self.log(f"No remote tag {tag_name} to delete", "info")
                    else:
                        self.log(f"Could not delete remote tag: {remote_result.stderr}", "warning")
                        success = False
                
                if success:
                    self.log(f"Successfully deleted {tag_name}", "success")
                else:
                    self.log(f"Some operations failed for {tag_name}", "error")
                
                QTimer.singleShot(1000, self.refresh_releases)
                
            except subprocess.TimeoutExpired:
                self.log(f"Timeout deleting {tag_name}", "error")
            except Exception as e:
                self.log(f"Error deleting {tag_name}: {e}", "error")
        
        threading.Thread(target=delete_operations, daemon=True).start()

    def browse_project_path(self):
        path = QFileDialog.getExistingDirectory(self, "Select Project Directory")
        if path:
            self.project_path = path
            self.path_label.setText(os.path.basename(path))
            self.update_project_status()
            
            package_json_path = Path(path) / "package.json"
            if package_json_path.exists():
                try:
                    with open(package_json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        version = data.get('version', '1.0.0')
                        self.version = version
                        self.version_display.setText(version)
                        self.log(f"Loaded version: {version}", "success")
                except Exception as e:
                    self.log(f"Error reading package.json: {e}", "error")
            
            if hasattr(self, 'placeholder_label') and self.placeholder_label:
                try:
                    self.placeholder_label.hide()
                except RuntimeError:
                    self.placeholder_label = None
            
            self.refresh_releases()

    def log(self, message, message_type="output"):
        self.log_signal.emit(message, message_type)

    def _log_to_console(self, message, message_type):
        colors = {
            "error": "#ff6b6b",
            "success": "#00d2d3", 
            "warning": "#fbc531",
            "info": "#00a8ff",
            "output": "#ffffff"
        }
        
        color = colors.get(message_type, "#ffffff")
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_message = f'<span style="color: #888888;">[{timestamp}]</span> <span style="color: {color};">{message}</span><br>'
        
        self.console_text.moveCursor(QTextCursor.MoveOperation.End)
        self.console_text.insertHtml(formatted_message)
        self.console_text.moveCursor(QTextCursor.MoveOperation.End)
        
        scrollbar = self.console_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def clear_console(self):
        self.console_text.clear()

    def copy_console(self):
        clipboard = QGuiApplication.clipboard()
        clipboard.setText(self.console_text.toPlainText())
        self.log("Console output copied to clipboard", "success")

    def command_finished(self, success, callback=None):
        self.is_working = False
        self.progress_bar.setVisible(False)
        self.update_status("Ready")
        
        if callback:
            callback(success)

    def update_status(self, message):
        self.status_bar.showMessage(message)

    def update_markdown_preview(self):
        if not hasattr(self, 'preview_browser'):
            return
        text = self.notes_text.toPlainText()
        try:
            html = markdown.markdown(text, extensions=[
                'fenced_code', 'codehilite', 'tables', 'sane_lists'
            ])
        except Exception:
            html = markdown.markdown(text)
        self.preview_browser.setHtml(html)

    def closeEvent(self, event):
        self.stop_all_commands()
        event.accept()

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("GitHub Release Manager - Modern")
    app.setApplicationVersion("2.0.0")
    
    try:
        import os
        os.nice(10)
    except Exception:
        _ = None
    
    window = ModernReleaseManager()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()