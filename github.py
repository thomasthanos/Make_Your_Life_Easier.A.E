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
                            QFileDialog, QMessageBox, QMenu, QSplitter, QSizePolicy,
                            QGridLayout, QGroupBox, QCheckBox)
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
            self.command_signal.emit(f"{self.command}")
            
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

class ModernReleaseManager(QMainWindow):
    log_signal = pyqtSignal(str, str)
    update_releases_signal = pyqtSignal(list, list)
    reset_refreshing_signal = pyqtSignal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("🚀 GitHub Release Manager - Modern")
        self.setGeometry(100, 100, 1400, 900)
        
        # Variables
        self.version = "1.0.0"
        self.release_type = "patch"
        self.project_path = ""
        self.is_working = False
        self.is_refreshing = False
        self.current_workers = []
        self.command_queue = Queue()
        self.current_view = "releases"
        self.views = {}  # Dictionary to store all views
        
        self.setup_ui()
        self.setup_electric_blue_styles()
        
        self.log_signal.connect(self._log_to_console)
        self.update_releases_signal.connect(self.update_releases_display)
        self.reset_refreshing_signal.connect(self._reset_refreshing)
        
        # Start queue processor
        self.queue_timer = QTimer()
        self.queue_timer.timeout.connect(self.process_command_queue)
        self.queue_timer.start(100)
        
        # Create all views upfront
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
            
            /* Modern Cards */
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
            
            /* Sidebar */
            QFrame#sidebar {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                          stop:0 #151528, stop:1 #1a1a2e);
                border-right: 1px solid #2a2a4a;
            }
            
            /* Labels */
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
            
            /* Modern Buttons - Electric Blue */
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
            
            /* Checkboxes - Electric Blue */
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
            
            /* Input Fields */
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
            
            /* Progress Bar */
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
            
            /* Tabs - Removed from view but keeping styles for other uses */
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
            
            /* Scroll Areas */
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
            
            /* Release Items */
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
            
            /* Group Boxes */
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
            
            /* Status Bar */
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
        
        # Modern Sidebar
        self.create_modern_sidebar(main_layout)
        
        # Main content area
        self.create_main_content(main_layout)
        
        # Status bar
        self.create_status_bar()

    def setup_all_views(self):
        """Create all views once and store them"""
        self.views["releases"] = self.create_releases_view()
        self.views["quick_release"] = self.create_quick_release_view()
        self.views["advanced"] = self.create_advanced_view()
        
        # Show initial view
        self.show_releases()

    def create_modern_sidebar(self, parent_layout):
        sidebar = QFrame()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(280)
        sidebar.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(15, 20, 15, 20)
        sidebar_layout.setSpacing(20)
        
        # App Title
        title_label = QLabel("🚀 Release Manager")
        title_label.setStyleSheet("font-size: 20px; font-weight: bold; color: #00a8ff; padding: 10px 0px;")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sidebar_layout.addWidget(title_label)
        
        # Project Section Card
        project_card = QFrame()
        project_card.setProperty("card", "true")
        project_layout = QVBoxLayout(project_card)
        project_layout.setSpacing(12)
        
        project_label = QLabel("📁 PROJECT")
        project_label.setStyleSheet("color: #00a8ff; font-size: 14px; font-weight: bold;")
        project_layout.addWidget(project_label)
        
        # Project Path
        self.select_path_btn = QPushButton("📂 Select Project Folder")
        self.select_path_btn.clicked.connect(self.browse_project_path)
        self.select_path_btn.setStyleSheet("text-align: left; padding-left: 15px;")
        project_layout.addWidget(self.select_path_btn)
        
        self.path_label = QLabel("No project selected")
        self.path_label.setWordWrap(True)
        self.path_label.setStyleSheet("color: #a0a0c0; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")
        project_layout.addWidget(self.path_label)
        
        # Version Info Card
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
        
        # Project Status
        self.project_status = QLabel("⏳ No project selected")
        self.project_status.setStyleSheet("color: #fbc531; font-size: 11px; background: #1a1a2e; padding: 8px; border-radius: 6px;")
        version_layout.addWidget(self.project_status)
        
        project_layout.addWidget(version_card)
        sidebar_layout.addWidget(project_card)
        
        # Navigation Section
        nav_card = QFrame()
        nav_card.setProperty("card", "true")
        nav_layout = QVBoxLayout(nav_card)
        
        nav_label = QLabel("🧭 Navigation")
        nav_label.setStyleSheet("color: #00a8ff; font-size: 14px; font-weight: bold; padding-bottom: 10px;")
        nav_layout.addWidget(nav_label)
        
        nav_buttons = [
            ("📋 View Releases", self.show_releases),
            ("⚡ Quick Releases", self.show_quick_release),
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
        
        # Use QSplitter for resizable content and console
        self.splitter = QSplitter(Qt.Orientation.Vertical)
        self.splitter.setStyleSheet("QSplitter::handle { background: #2a2a4a; }")
        
        # Main content widget (will show different views)
        self.main_content_stack = QWidget()
        self.main_content_layout = QVBoxLayout(self.main_content_stack)
        self.main_content_layout.setContentsMargins(0, 0, 0, 0)
        
        self.splitter.addWidget(self.main_content_stack)
        
        # Console area - LARGER OUTPUT
        console_frame = QFrame()
        console_frame.setProperty("card", "true")
        console_layout = QVBoxLayout(console_frame)
        console_layout.setSpacing(10)
        
        # Console header
        console_header = QWidget()
        console_header_layout = QHBoxLayout(console_header)
        console_header_layout.setContentsMargins(0, 0, 0, 0)
        
        console_label = QLabel("📊 Output Console")
        console_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #00a8ff;")
        console_header_layout.addWidget(console_label)
        
        console_header_layout.addStretch()
        
        # Console buttons
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
        
        # Console text area - MADE LARGER
        self.console_text = QTextEdit()
        self.console_text.setFont(QFont("Consolas", 11))  # Larger font
        self.console_text.setReadOnly(True)
        self.console_text.setMinimumHeight(250)  # Minimum height increased
        console_layout.addWidget(self.console_text)
        
        self.splitter.addWidget(console_frame)
        
        # Set sizes: console takes 45% of space (larger output)
        self.splitter.setStretchFactor(0, 55)
        self.splitter.setStretchFactor(1, 45)
        self.splitter.setSizes([500, 400])  # Initial heights
        
        main_layout.addWidget(self.splitter)
        parent_layout.addWidget(main_content, 1)  # Take remaining space

    def create_status_bar(self):
        self.status_bar = self.statusBar()
        self.status_bar.showMessage("✅ Ready")
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setMaximumWidth(250)
        self.progress_bar.setVisible(False)
        self.status_bar.addPermanentWidget(self.progress_bar)

    def create_releases_view(self):
        """Create the releases view widget"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(15)
        
        # Header
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
        
        test_btn = QPushButton("🔧 Test GitHub CLI")
        test_btn.clicked.connect(self.test_github_cli)
        test_btn.setFixedWidth(140)
        header_layout.addWidget(test_btn)
        
        layout.addWidget(header)
        
        # Releases list - MODERN VERSION
        releases_card = QFrame()
        releases_card.setProperty("card", "true")
        releases_layout = QVBoxLayout(releases_card)
        releases_layout.setSpacing(10)
        
        # Stats bar
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
        
        # Releases scroll area
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
        
        # Create container widget for releases
        self.releases_container = QWidget()
        self.releases_container.setStyleSheet("background: transparent;")
        self.releases_layout = QVBoxLayout(self.releases_container)
        self.releases_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.releases_layout.setSpacing(8)
        self.releases_layout.setContentsMargins(5, 5, 5, 5)
        
        # Initial placeholder
        self.setup_initial_placeholder()
        
        self.releases_scroll.setWidget(self.releases_container)
        releases_layout.addWidget(self.releases_scroll, 1)
        
        layout.addWidget(releases_card, 1)
        
        return widget

    def create_quick_release_view(self):
        """Create the quick release view widget"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(20)
        
        # Title
        title = QLabel("⚡ Quick Release")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: #00a8ff; text-align: center; padding: 10px;")
        layout.addWidget(title)
        
        # Main content area
        content_widget = QWidget()
        content_layout = QHBoxLayout(content_widget)
        content_layout.setSpacing(30)
        
        # Left side - Release type selection with CHECKBOXES
        left_frame = QFrame()
        left_frame.setProperty("card", "true")
        left_frame.setFixedWidth(400)
        left_layout = QVBoxLayout(left_frame)
        left_layout.setSpacing(15)
        
        type_label = QLabel("🎯 Release Type")
        type_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #00a8ff;")
        left_layout.addWidget(type_label)
        
        self.type_group = QButtonGroup()
        self.type_group.setExclusive(True)  # Only one can be selected
        
        types = [
            ("🔧 Patch Release", "patch", "Bug fixes and minor updates", "#00d2d3"),
            ("✨ Minor Release", "minor", "New features and improvements", "#00a8ff"),
            ("🚀 Major Release", "major", "Breaking changes and major updates", "#9c88ff")
        ]
        
        for text, value, description, color in types:
            checkbox_card = QFrame()
            checkbox_card.setProperty("card", "true")
            checkbox_layout = QVBoxLayout(checkbox_card)
            checkbox_layout.setSpacing(8)
            
            checkbox_row = QHBoxLayout()
            checkbox = QCheckBox(text)
            checkbox.setProperty("value", value)
            checkbox.setStyleSheet(f"color: {color}; font-weight: bold; font-size: 14px;")
            if value == "patch":
                checkbox.setChecked(True)
            
            self.type_group.addButton(checkbox)
            checkbox.toggled.connect(self.on_release_type_changed)
            checkbox_row.addWidget(checkbox)
            checkbox_row.addStretch()
            
            desc_label = QLabel(description)
            desc_label.setStyleSheet("color: #a0a0c0; font-size: 12px; padding-left: 25px;")
            desc_label.setWordWrap(True)
            
            checkbox_layout.addLayout(checkbox_row)
            checkbox_layout.addWidget(desc_label)
            left_layout.addWidget(checkbox_card)
        
        left_layout.addStretch()
        content_layout.addWidget(left_frame)
        
        # Right side - Quick actions
        right_frame = QFrame()
        right_frame.setProperty("card", "true")
        right_layout = QVBoxLayout(right_frame)
        right_layout.setSpacing(20)
        
        action_label = QLabel("⚡ Quick Actions")
        action_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #00a8ff;")
        right_layout.addWidget(action_label)
        
        # Version preview
        preview_card = QFrame()
        preview_card.setProperty("card", "true")
        preview_layout = QVBoxLayout(preview_card)
        
        preview_label = QLabel("📊 Version Preview")
        preview_label.setStyleSheet("font-size: 14px; font-weight: bold; color: #00a8ff;")
        preview_layout.addWidget(preview_label)
        
        self.version_preview = QLabel("1.0.1")
        self.version_preview.setStyleSheet("font-size: 32px; font-weight: bold; color: #00d2d3; text-align: center; padding: 15px;")
        self.version_preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        preview_layout.addWidget(self.version_preview)
        
        preview_note = QLabel("Next version based on current selection")
        preview_note.setStyleSheet("color: #a0a0c0; font-size: 11px; text-align: center;")
        preview_layout.addWidget(preview_note)
        
        right_layout.addWidget(preview_card)
        
        # Quick action button
        quick_btn = QPushButton("🚀 CREATE QUICK RELEASE")
        quick_btn.clicked.connect(lambda: self.queue_command(self.auto_release))
        quick_btn.setStyleSheet("""
            QPushButton {
                font-size: 16px;
                font-weight: bold;
                height: 60px;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                      stop:0 #00a8ff, stop:0.5 #0097e6, stop:1 #00a8ff);
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                      stop:0 #0097e6, stop:0.5 #0087d6, stop:1 #0097e6);
            }
        """)
        right_layout.addWidget(quick_btn)
        
        right_layout.addStretch()
        content_layout.addWidget(right_frame)
        
        layout.addWidget(content_widget, 1)
        layout.addStretch()
        
        return widget

    def create_advanced_view(self):
        """Create the advanced tools view widget"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(15, 15, 15, 15)
        layout.setSpacing(15)
        
        # Title
        title = QLabel("⚙️ Advanced Tools")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: #00a8ff; text-align: center; padding: 10px;")
        layout.addWidget(title)
        
        # Use grid layout for compact arrangement
        grid_widget = QWidget()
        grid_layout = QGridLayout(grid_widget)
        grid_layout.setSpacing(15)
        
        # Release Details - Left Column
        details_group = QGroupBox("📝 Release Details")
        details_layout = QVBoxLayout(details_group)
        details_layout.setSpacing(10)
        
        # Version Input
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
        
        # Title
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
        
        # Release Notes - More compact
        notes_label = QLabel("Release Notes:")
        notes_label.setStyleSheet("color: #e0e0ff;")
        details_layout.addWidget(notes_label)
        
        self.notes_text = QTextEdit()
        self.notes_text.setMaximumHeight(120)
        self.notes_text.setPlaceholderText("Enter release notes...")
        details_layout.addWidget(self.notes_text)
        
        grid_layout.addWidget(details_group, 0, 0)
        
        # Build Actions - Right Top
        build_group = QGroupBox("🔨 Build Actions")
        build_layout = QVBoxLayout(build_group)
        build_layout.setSpacing(8)
        
        build_buttons = [
            ("🔧 Build Project", lambda: self.queue_command(self.safe_build_single)),
            ("🧹 Clean & Rebuild", self.clean_and_rebuild),
        ]
        
        for text, command in build_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            btn.setMinimumHeight(35)
            build_layout.addWidget(btn)
        
        grid_layout.addWidget(build_group, 0, 1)
        
        # Release Actions - Right Middle
        release_group = QGroupBox("🚀 Release Actions")
        release_layout = QVBoxLayout(release_group)
        release_layout.setSpacing(8)
        
        release_buttons = [
            ("📦 Create Release", self.create_release),
            ("✏️ Update Latest Release", self.update_release),
        ]
        
        for text, command in release_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            btn.setMinimumHeight(35)
            release_layout.addWidget(btn)
        
        grid_layout.addWidget(release_group, 1, 1)
        
        # Danger Zone - Right Bottom
        danger_group = QGroupBox("⚠️ Danger Zone")
        danger_layout = QVBoxLayout(danger_group)
        danger_layout.setSpacing(8)
        
        danger_buttons = [
            ("🗑️ Delete Latest Release", self.delete_current_tag),
        ]
        
        for text, command in danger_buttons:
            btn = QPushButton(text)
            btn.clicked.connect(command)
            btn.setMinimumHeight(35)
            btn.setStyleSheet("background-color: #ff6b6b;")
            danger_layout.addWidget(btn)
        
        grid_layout.addWidget(danger_group, 1, 0)
        
        grid_layout.setColumnStretch(0, 1)
        grid_layout.setColumnStretch(1, 1)
        
        layout.addWidget(grid_widget, 1)
        layout.addStretch()
        
        return widget

    def setup_initial_placeholder(self):
        """Setup the initial placeholder message based on project path status"""
        # Clear any existing placeholder first
        if hasattr(self, 'placeholder_label') and self.placeholder_label:
            try:
                self.releases_layout.removeWidget(self.placeholder_label)
                self.placeholder_label.deleteLater()
            except:
                pass
            self.placeholder_label = None
        
        # Only create placeholder if no project is selected
        if not self.project_path:
            # NO PROJECT SELECTED - Show setup instructions
            self.placeholder_label = QLabel()
            self.placeholder_label.setTextFormat(Qt.TextFormat.RichText)
            self.placeholder_label.setText("""
            <div style="text-align: center; padding: 40px 20px;">
                <h3 style="color: #00a8ff; margin-bottom: 25px; font-size: 20px; font-weight: bold;">GitHub Release Manager</h3>
                
                <div style="display: inline-block; text-align: left; max-width: 500px;">
                    <!-- Step 1 -->
                    <div style="margin-bottom: 20px;">
                        <div style="color: #00a8ff; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                            1. Select Project Folder
                        </div>
                        <div style="color: #a0a0c0; font-size: 12px; line-height: 1.4; padding-left: 8px;">
                            Click <span style="color: #00a8ff; font-weight: bold;">"Select Project Folder"</span> in the sidebar to choose your project directory
                        </div>
                    </div>
                    
                    <!-- Step 2 -->
                    <div style="margin-bottom: 20px;">
                        <div style="color: #00d2d3; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                            2. Install & Authenticate GitHub CLI
                        </div>
                        <div style="color: #a0a0c0; font-size: 12px; line-height: 1.4; padding-left: 8px;">
                            • Install from: <span style="color: #00d2d3;">https://cli.github.com/</span><br>
                            • Run: <code style="color: #00d2d3; font-family: monospace;">gh auth login</code> to authenticate
                        </div>
                    </div>
                    
                    <!-- Step 3 -->
                    <div style="margin-bottom: 25px;">
                        <div style="color: #9c88ff; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                            3. Start Managing Releases
                        </div>
                        <div style="color: #a0a0c0; font-size: 12px; line-height: 1.4; padding-left: 8px;">
                            Once setup is complete, click <span style="color: #9c88ff; font-weight: bold;">"Refresh"</span> to load your releases
                        </div>
                    </div>
                </div>
                
                <!-- Help tip -->
                <div style="color: #8888aa; font-size: 11px; margin-top: 20px;">
                    Need help? Check the GitHub CLI documentation for detailed setup instructions
                </div>
            </div>
            """)
            self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.placeholder_label.setWordWrap(True)
            self.releases_layout.addWidget(self.placeholder_label)
        else:
            # PROJECT SELECTED - Don't create placeholder at all
            self.placeholder_label = None

    def switch_view(self, view_name):
        """Switch between views"""
        self.clear_main_content()
        if view_name in self.views:
            self.main_content_layout.addWidget(self.views[view_name])

    def clear_main_content(self):
        """Clear the main content area"""
        while self.main_content_layout.count():
            child = self.main_content_layout.takeAt(0)
            if child.widget():
                child.widget().setParent(None)  # Just remove, don't delete

    def on_release_type_changed(self):
        checkbox = self.sender()
        if checkbox.isChecked():
            self.release_type = checkbox.property("value")
            # Update version preview
            if self.version:
                new_version = self.calculate_new_version(self.version, self.release_type)
                self.version_preview.setText(new_version)

    def suggest_version(self):
        """Suggests the next version based on release_type""" 
        if not self.version:
            self.log("No current version found", "error")
            return
            
        current_version = self.version
        suggested_version = self.calculate_new_version(current_version, self.release_type)
        self.log(f"Suggested version: {suggested_version}", "info")
        self.version_entry.setText(suggested_version)

    # Command Queue System
    def queue_command(self, command_func):
        self.command_queue.put(command_func)
        self.log(f"Queued: {command_func.__name__}", "info")

    def process_command_queue(self):
        try:
            if not self.is_working and not self.command_queue.empty():
                command_func = self.command_queue.get_nowait()
                self.log(f"Executing: {command_func.__name__}", "info")
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
        self.log("All commands stopped", "warning")

    # Navigation methods
    def show_releases(self):
        self.current_view = "releases"
        self.switch_view("releases")
        self.refresh_releases()

    def show_quick_release(self):
        self.current_view = "quick_release"
        self.switch_view("quick_release")

    def show_advanced(self):
        self.current_view = "advanced"
        self.switch_view("advanced")

    def test_github_cli(self):
        """Test if GitHub CLI is working - DIAGNOSTIC ONLY""" 
        self.log("Testing GitHub CLI...", "info")
        
        def test_cli():
            try:
                self.log("Running gh --version", "info")
                # Test 1: Check if gh is installed
                result1 = subprocess.run(["gh", "--version"], capture_output=True, text=True)
                if result1.returncode != 0:
                    self.log("GitHub CLI is not installed", "error")
                    self.log("Install from: https://cli.github.com/", "info")
                    return
                
                self.log("GitHub CLI is installed", "success")
                
                self.log("Running gh auth status", "info")
                # Test 2: Check authentication
                result2 = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
                if result2.returncode != 0:
                    self.log("Not authenticated with GitHub CLI", "error")
                    self.log("Run: gh auth login", "info")
                    return
                
                self.log("Authenticated with GitHub", "success")
                
                # Test 3: Try to get releases (diagnostic only)
                if self.project_path:
                    self.log("Running gh release list", "info")
                    result3 = subprocess.run(["gh", "release", "list", "--limit", "3"], capture_output=True, text=True, cwd=self.project_path)
                    if result3.returncode == 0:
                        self.log(f"GitHub CLI working - found releases", "success")
                        # Don't display release data in console - just confirm it works
                    else:
                        self.log(f"GitHub CLI list error: {result3.stderr}", "warning")
                
            except Exception as e:
                self.log(f"Error testing GitHub CLI: {e}", "error")
            finally:
                self.log("Test completed, refreshing releases", "info")
                QTimer.singleShot(0, self.refresh_releases)
        
        threading.Thread(target=test_cli, daemon=True).start()

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
            except:
                pass
        
        time.sleep(3)
        self.log(f"Killed {killed_count} processes", "success")

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
                time.sleep(3)
        return False

    def clean_and_rebuild(self):
        """Clean everything and do a fresh rebuild""" 
        if not self.check_project_selected():
            return
            
        self.log("Clean and rebuild...", "info")
        
        # Clean dist folder
        if self.safe_delete_dist():
            self.log("Dist folder cleaned", "success")
        else:
            self.log("Failed to clean dist folder", "error")
            return
            
        # Clean node_modules and reinstall
        def clean_operations():
            # Remove node_modules
            node_modules_path = Path(self.project_path) / "node_modules"
            if node_modules_path.exists():
                self.log("Removing node_modules...", "info")
                shutil.rmtree(node_modules_path)
                self.log("node_modules removed", "success")
            
            # Remove package-lock.json
            package_lock_path = Path(self.project_path) / "package-lock.json"
            if package_lock_path.exists():
                package_lock_path.unlink()
                self.log("package-lock.json removed", "success")
            
            # Reinstall dependencies
            self.log("Reinstalling dependencies...", "info")
            if self.run_command_sync("npm install"):
                self.log("Dependencies installed", "success")
                
                # Rebuild
                self.log("Rebuilding...", "info")
                if self.safe_build_single():
                    self.log("Rebuild completed successfully", "success")
                else:
                    self.log("Rebuild failed", "error")
            else:
                self.log("Failed to install dependencies", "error")
        
        threading.Thread(target=clean_operations, daemon=True).start()

    def safe_build_single(self):
        if not self.check_project_selected():
            return False
            
        self.log("Safe build...", "info")
        
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
                
            self.log(f"Trying: {build_cmd}", "info '")
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
        """Run command synchronously without threading""" 
        if require_project and not self.check_project_selected():
            return False
            
        if check_git and not self.check_git_repository():
            return False
            
        try:
            self.log(f"{command}", "info")
            process = subprocess.run(command, shell=True, capture_output=True, text=True, 
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

    def auto_release(self):
        if not self.check_project_selected():
            return
            
        self.log("Auto release...", "info")
        
        if self.safe_build_single():
            time.sleep(5)
            if self.check_dist_files_exist():
                self.create_release()
            else:
                self.log("Files missing", "error")

    def create_release(self):
        if not self.check_git_repository() or not self.check_dist_files_exist():
            self.log("Checks failed", "error")
            return
        
        # Use version from input field
        new_version = self.version_entry.text().strip()
        
        # Validate version
        if not new_version:
            self.log("Please enter a version number", "error")
            return
        
        # Validate version format (e.g. 1.2.3)
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
            # Write notes to file
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            self.log(f"Notes written to: {temp_notes_file}", "info")
            
            # Check if file was created correctly
            if temp_notes_file.exists():
                file_size = temp_notes_file.stat().st_size
                self.log(f"Notes file size: {file_size} bytes", "info")
            
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
                    
                    self.log(f"Executing: {' '.join(create_command)}", "info")
                    
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
            
            # Run in thread to not block UI
            threading.Thread(target=create_release_sync, daemon=True).start()
            
        except Exception as e:
            if temp_notes_file.exists():
                temp_notes_file.unlink()
            self.log(f"Error preparing release: {e}", "error")

    def update_version_display(self, new_version):
        """Update version in UI""" 
        self.version = new_version
        self.version_display.setText(new_version)
        if hasattr(self, 'version_preview'):
            self.version_preview.setText(self.calculate_new_version(new_version, self.release_type))
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
                except:
                    pass
                
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
        """Delete the latest release and tag""" 
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
                # Delete release
                delete_release_cmd = f"gh release delete {latest_tag} --yes"
                if self.run_command_sync(delete_release_cmd):
                    self.log(f"Release {latest_tag} deleted", "success")
                    
                    # Delete local tag
                    delete_local_tag_cmd = f"git tag -d {latest_tag}"
                    self.run_command_sync(delete_local_tag_cmd)
                    
                    # Delete remote tag
                    delete_remote_tag_cmd = f"git push origin --delete {latest_tag}"
                    self.run_command_sync(delete_remote_tag_cmd)
                    
                    QTimer.singleShot(0, self.refresh_releases)
                else:
                    self.log(f"Failed to delete release {latest_tag}", "error")
            except Exception as e:
                self.log(f"Error deleting: {e}", "error")
        
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
        
        # ΕΛΕΓΧΟΣ: Μόνο αν είμαστε στο releases view
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
                            # Sort releases by createdAt descending
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
                        self.log(f"Found {len(all_tags)} git tags", "success")
                    else:
                        self.log("No git tags found", "warning")
                else:
                    self.log(f"git tag failed with code {tags_result.returncode}", "error")
                    self.log(f"Error: {tags_result.stderr}", "error")
                
                # ΕΛΕΓΧΟΣ: Μόνο αν ακόμα είμαστε στο releases view
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
        """Update the releases panel with releases and tags - MODERN VERSION""" 
        # Use QTimer to ensure this runs in the main thread and we can safely check the layout
        QTimer.singleShot(0, lambda: self._safe_update_releases_display(releases, all_tags))

    def _safe_update_releases_display(self, releases, all_tags):
        """Safely update releases display with proper error handling"""
        try:
            # ΕΛΕΓΧΟΣ: Μόνο αν είμαστε στο releases view
            if self.current_view != "releases":
                self.log("Not in releases view, skipping UI update", "info")
                return
                
            # Check if the releases container and layout still exist
            if not self.releases_container or not self.releases_layout:
                self.log("Releases layout no longer exists, skipping update", "warning")
                return
                
            # Clear existing content (BUT keep placeholder if it exists)
            self.clear_releases_layout()
            
            # Update stats
            releases_count = len(releases)
            tags_count = len(all_tags)
            self.releases_count_label.setText(f"📦 Releases: {releases_count}")
            self.tags_count_label.setText(f"🏷️ Tags: {tags_count}")
            
            # Update last update time
            current_time = datetime.now().strftime("%H:%M:%S")
            self.last_update_label.setText(f"Last update: {current_time}")
            
            if not releases and not all_tags:
                # No releases found - show appropriate message
                if not self.project_path:
                    # Only create placeholder if it doesn't exist
                    if not hasattr(self, 'placeholder_label') or not self.placeholder_label:
                        self.setup_initial_placeholder()
                    else:
                        self.placeholder_label.show()
                else:
                    # Project selected but no releases found
                    if not hasattr(self, 'placeholder_label') or not self.placeholder_label:
                        self.placeholder_label = QLabel()
                        self.placeholder_label.setTextFormat(Qt.TextFormat.RichText)
                        self.placeholder_label.setText("""
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
                                    <span style="color: #fbc531;">•</span> Check if the repository has any releases or tags
                                </p>
                            </div>
                            <p style="color: #8888aa; font-size: 12px; margin-top: 20px;">
                                Try the "Test GitHub CLI" button to verify your setup.
                            </p>
                        </div>
                        """)
                        self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                        self.placeholder_label.setWordWrap(True)
                        self.releases_layout.addWidget(self.placeholder_label)
                    else:
                        self.placeholder_label.show()
                return
            
            # Hide placeholder if we have releases to show
            if hasattr(self, 'placeholder_label') and self.placeholder_label:
                self.placeholder_label.hide()
            
            # Create a set of release tags for quick lookup
            release_tags = {release['tagName'] for release in releases}
            
            # Display releases first
            if releases:
                releases_header = QLabel("🚀 GitHub Releases")
                releases_header.setStyleSheet("""
                    font-size: 16px; 
                    font-weight: bold; 
                    color: #00a8ff; 
                    margin-top: 10px; 
                    margin-bottom: 10px;
                    padding: 8px;
                    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                                stop:0 transparent, stop:0.5 #00a8ff20, stop:1 transparent);
                    border-radius: 6px;
                """)
                releases_header.setAlignment(Qt.AlignmentFlag.AlignCenter)
                self.releases_layout.addWidget(releases_header)
                
                for release in releases:
                    self.add_release_item(release, is_release=True)

            # Display tags without releases
            tags_without_releases = [tag for tag in all_tags if tag not in release_tags]
            if tags_without_releases:
                tags_header = QLabel("🏷️ Git Tags (No Release)")
                tags_header.setStyleSheet("""
                    font-size: 16px; 
                    font-weight: bold; 
                    color: #fbc531; 
                    margin-top: 20px; 
                    margin-bottom: 10px;
                    padding: 8px;
                    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                                stop:0 transparent, stop:0.5 #fbc53120, stop:1 transparent);
                    border-radius: 6px;
                """)
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
            
            # Add stretch at the end to prevent expansion issues
            self.releases_layout.addStretch()
            
        except RuntimeError as e:
            # Layout has been deleted, ignore the update
            pass
        except Exception as e:
            print(f"Unexpected error updating releases display: {e}")

    def clear_releases_layout(self):
        """Clear all widgets from releases layout except placeholder"""
        try:
            if not self.releases_layout:
                return
                
            # Create a list to store widgets to remove (excluding placeholder)
            widgets_to_remove = []
            
            # First, identify all widgets except the placeholder
            for i in range(self.releases_layout.count()):
                child = self.releases_layout.itemAt(i)
                if child and child.widget():
                    if child.widget() != self.placeholder_label:
                        widgets_to_remove.append(child.widget())
            
            # Remove identified widgets
            for widget in widgets_to_remove:
                try:
                    self.releases_layout.removeWidget(widget)
                    widget.deleteLater()
                except Exception:
                    pass
                    
        except Exception:
            pass

    def add_release_item(self, release, is_release=True):
        """Add a release/tag item to the releases panel - MODERN VERSION""" 
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
        
        # Left side - Release info
        info_layout = QVBoxLayout()
        info_layout.setSpacing(6)
        
        # Title/tag with icon
        title = release.get('name', release['tagName'])
        title_label = QLabel(f"{'🚀' if is_release else '🏷️'} {title}")
        title_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        title_label.setStyleSheet("color: #ffffff;")
        title_label.setWordWrap(True)
        info_layout.addWidget(title_label)
        
        # Tag name and date
        meta_layout = QHBoxLayout()
        
        tag_label = QLabel(f"📌 {release['tagName']}")
        tag_label.setStyleSheet("color: #00a8ff; font-size: 10px; font-weight: bold; background: #00a8ff20; padding: 2px 8px; border-radius: 10px;")
        meta_layout.addWidget(tag_label)
        
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
        
        # Right side - Status badges and actions
        right_layout = QVBoxLayout()
        right_layout.setSpacing(6)
        right_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        
        # Status badges container
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
        
        # Delete button
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
        
        self.log(f"Deleting {'release' if is_release else 'tag'} {tag_name}...", "warning")
        
        def delete_operations():
            try:
                success = True
                
                if is_release:
                    # Delete GitHub release first
                    delete_release_cmd = f"gh release delete {tag_name} --yes"
                    result = subprocess.run(delete_release_cmd, shell=True, capture_output=True, text=True, 
                                          cwd=self.project_path, timeout=30)
                    
                    if result.returncode == 0:
                        self.log(f"GitHub release {tag_name} deleted", "success")
                    else:
                        self.log(f"Could not delete GitHub release (may not exist): {result.stderr}", "warning")
                        # Continue with tag deletion even if release delete fails
                
                # Delete local tag
                delete_local_cmd = f"git tag -d {tag_name}"
                local_result = subprocess.run(delete_local_cmd, shell=True, capture_output=True, text=True,
                                            cwd=self.project_path, timeout=30)
                
                if local_result.returncode == 0:
                    self.log(f"Local tag {tag_name} deleted", "success")
                else:
                    if "tag '{tag_name}' not found" in local_result.stderr:
                        self.log(f"No local tag {tag_name} to delete", "info")
                    else:
                        self.log(f"Could not delete local tag: {local_result.stderr}", "warning")
                        success = False
                
                # Delete remote tag
                delete_remote_cmd = f"git push origin --delete {tag_name}"
                remote_result = subprocess.run(delete_remote_cmd, shell=True, capture_output=True, text=True,
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
                
                # Refresh the display regardless
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
            
            # Load version from package.json
            package_json_path = Path(path) / "package.json"
            if package_json_path.exists():
                try:
                    with open(package_json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        version = data.get('version', '1.0.0')
                        self.version = version
                        self.version_display.setText(version)
                        if hasattr(self, 'version_preview'):
                            self.version_preview.setText(self.calculate_new_version(version, self.release_type))
                        self.log(f"Loaded version: {version}", "success")
                except Exception as e:
                    self.log(f"Error reading package.json: {e}", "error")
            
            # HIDE THE PLACEHOLDER WHEN PROJECT IS SELECTED
            if hasattr(self, 'placeholder_label') and self.placeholder_label:
                try:
                    self.placeholder_label.hide()
                except RuntimeError:
                    # Object already deleted, just remove the reference
                    self.placeholder_label = None
            
            self.refresh_releases()

    def log(self, message, message_type="output"):
        """Thread-safe logging using signal""" 
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
        
        # Auto-scroll
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

    def closeEvent(self, event):
        self.stop_all_commands()
        event.accept()

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("GitHub Release Manager - Modern")
    app.setApplicationVersion("2.0.0")
    
    window = ModernReleaseManager()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()