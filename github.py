import customtkinter as ctk
from tkinter import messagebox, scrolledtext, filedialog
import subprocess
import json
from pathlib import Path
import threading
import sys
import os
from datetime import datetime
import time
import psutil
from queue import Queue, Empty
import shutil

# Configure appearance
ctk.set_appearance_mode("Dark")  # Dark, Light, System
ctk.set_default_color_theme("blue")  # blue, green, dark-blue

class ModernReleaseManager(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("🚀 GitHub Release Manager - Ultimate")
        self.geometry("1200x900")
        self.minsize(1000, 700)
        
        # Variables
        self.version_var = ctk.StringVar(value="1.1.7")
        self.release_type_var = ctk.StringVar(value="patch")
        self.release_title_var = ctk.StringVar()
        self.project_path_var = ctk.StringVar()
        self.is_working = False
        self.current_command = None
        self.command_queue = Queue()
        self.processing_queue = False
        
        self.setup_ui()
        self.after(100, self.load_initial_state)
        self.after(100, self.process_command_queue)
        
    def setup_ui(self):
        # Create main grid
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # Sidebar
        self.create_sidebar()
        
        # Main content area
        self.create_main_content()
        
        # Status bar
        self.create_status_bar()
        
    def create_sidebar(self):
        sidebar = ctk.CTkFrame(self, width=250, corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        sidebar.grid_rowconfigure(6, weight=1)
        
        # Logo/Title
        title_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        title_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=20)
        
        ctk.CTkLabel(title_frame, text="🚀", font=("Arial", 24)).pack()
        ctk.CTkLabel(title_frame, text="Release Manager", 
                    font=("Arial", 16, "bold")).pack()
        ctk.CTkLabel(title_frame, text="by Thomas", 
                    font=("Arial", 12), text_color="gray").pack()
        
        # Project Section
        project_section = ctk.CTkFrame(sidebar, fg_color="transparent")
        project_section.grid(row=1, column=0, sticky="ew", padx=15, pady=10)
        
        ctk.CTkLabel(project_section, text="PROJECT", 
                    font=("Arial", 12, "bold"), text_color="gray").pack(anchor="w")
        
        # Project Path
        path_frame = ctk.CTkFrame(project_section, fg_color="transparent")
        path_frame.pack(fill="x", pady=5)
        
        ctk.CTkButton(path_frame, text="📁 Select Project", 
                     command=self.browse_project_path,
                     width=120).pack(fill="x")
        
        self.path_label = ctk.CTkLabel(path_frame, text="No project selected",
                    font=("Arial", 10), text_color="gray", wraplength=200)
        self.path_label.pack(fill="x", pady=(5, 0))
        
        # Version Info
        version_frame = ctk.CTkFrame(project_section, fg_color="transparent")
        version_frame.pack(fill="x", pady=5)
        
        ctk.CTkLabel(version_frame, text="Current Version:").pack(anchor="w")
        version_display = ctk.CTkFrame(version_frame, height=40)
        version_display.pack(fill="x", pady=5)
        version_display.pack_propagate(False)
        
        ctk.CTkLabel(version_display, textvariable=self.version_var,
                    font=("Arial", 18, "bold")).pack(expand=True)
        
        # Project Status
        self.project_status = ctk.CTkLabel(project_section, 
                                         text="🔴 No project selected",
                                         font=("Arial", 10), 
                                         text_color="#e74c3c")
        self.project_status.pack(anchor="w", pady=5)
        
        # Quick Stats
        stats_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        stats_frame.grid(row=2, column=0, sticky="ew", padx=15, pady=10)
        
        ctk.CTkLabel(stats_frame, text="QUICK STATS", 
                    font=("Arial", 12, "bold"), text_color="gray").pack(anchor="w")
        
        self.releases_count = ctk.CTkLabel(stats_frame, text="Releases: Loading...",
                                          font=("Arial", 11))
        self.releases_count.pack(anchor="w", pady=2)
        
        self.latest_version = ctk.CTkLabel(stats_frame, text="Latest: v1.1.7",
                                          font=("Arial", 11))
        self.latest_version.pack(anchor="w", pady=2)
        
        # Navigation
        nav_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        nav_frame.grid(row=3, column=0, sticky="ew", padx=15, pady=20)
        
        nav_buttons = [
            ("📊 Dashboard", self.show_dashboard),
            ("⚡ Quick Release", self.show_quick_release),
            ("🔧 Advanced", self.show_advanced),
            ("📋 Releases", self.show_releases),
        ]
        
        for text, command in nav_buttons:
            btn = ctk.CTkButton(nav_frame, text=text, command=command,
                               fg_color="transparent", hover_color=("gray70", "gray30"),
                               anchor="w", height=35)
            btn.pack(fill="x", pady=2)

        # Troubleshooting Section
        troubleshooting_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        troubleshooting_frame.grid(row=7, column=0, sticky="ew", padx=15, pady=10)
        
        ctk.CTkLabel(troubleshooting_frame, text="TROUBLESHOOTING", 
                    font=("Arial", 12, "bold"), text_color="gray").pack(anchor="w")
        
        ctk.CTkButton(troubleshooting_frame, text="🛠️ Kill Electron Only", 
                     command=lambda: self.queue_command(self.kill_electron_only),
                     fg_color="#e74c3c", hover_color="#c0392b").pack(fill="x", pady=2)
        
        ctk.CTkButton(troubleshooting_frame, text="🔍 Find File Lockers", 
                     command=lambda: self.queue_command(self.find_file_lockers),
                     fg_color="#9b59b6", hover_color="#8e44ad").pack(fill="x", pady=2)
        
        ctk.CTkButton(troubleshooting_frame, text="🔒 Quick Clean", 
                     command=lambda: self.queue_command(self.quick_clean),
                     fg_color="#f39c12", hover_color="#d35400").pack(fill="x", pady=2)
        
        ctk.CTkButton(troubleshooting_frame, text="🔄 Safe Build", 
                     command=lambda: self.queue_command(self.safe_build_single),
                     fg_color="#27ae60", hover_color="#219653").pack(fill="x", pady=2)
        
    def create_main_content(self):
        main_content = ctk.CTkFrame(self, corner_radius=10)
        main_content.grid(row=0, column=1, sticky="nsew", padx=(0, 10), pady=10)
        main_content.grid_columnconfigure(0, weight=1)
        main_content.grid_rowconfigure(1, weight=1)
        
        # Tabview for different sections
        self.tabview = ctk.CTkTabview(main_content)
        self.tabview.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        # Create tabs
        self.dashboard_tab = self.tabview.add("📊 Dashboard")
        self.quick_tab = self.tabview.add("⚡ Quick Release")
        self.advanced_tab = self.tabview.add("🔧 Advanced")
        self.releases_tab = self.tabview.add("📋 Releases")
        
        self.setup_dashboard_tab()
        self.setup_quick_tab()
        self.setup_advanced_tab()
        self.setup_releases_tab()
        
        # Console area
        console_frame = ctk.CTkFrame(main_content)
        console_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        console_frame.grid_columnconfigure(0, weight=1)
        console_frame.grid_rowconfigure(0, weight=1)
        
        # Console header
        console_header = ctk.CTkFrame(console_frame, fg_color="transparent")
        console_header.grid(row=0, column=0, sticky="ew", padx=10, pady=5)
        
        ctk.CTkLabel(console_header, text="📟 Output Console", 
                    font=("Arial", 14, "bold")).pack(side="left")
        
        console_controls = ctk.CTkFrame(console_header, fg_color="transparent")
        console_controls.pack(side="right")
        
        ctk.CTkButton(console_controls, text="Clear", width=80,
                     command=self.clear_console).pack(side="left", padx=5)
        ctk.CTkButton(console_controls, text="Copy", width=80,
                     command=self.copy_console).pack(side="left", padx=5)
        ctk.CTkButton(console_controls, text="Stop All", width=100,
                     command=self.stop_all_commands,
                     fg_color="#e74c3c", hover_color="#c0392b").pack(side="left", padx=5)
        
        # Console text area
        self.console_text = ctk.CTkTextbox(console_frame, font=("Consolas", 11))
        self.console_text.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        
        # Configure text tags for colors
        self.console_text.tag_config("info", foreground="white")
        self.console_text.tag_config("success", foreground="#27ae60")
        self.console_text.tag_config("error", foreground="#e74c3c")
        self.console_text.tag_config("warning", foreground="#f39c12")
        self.console_text.tag_config("output", foreground="#95a5a6")
        self.console_text.tag_config("timestamp", foreground="#7f8c8d")
        
    def create_status_bar(self):
        status_bar = ctk.CTkFrame(self, height=30, corner_radius=0)
        status_bar.grid(row=1, column=0, columnspan=2, sticky="ew")
        status_bar.grid_propagate(False)
        
        status_bar.grid_columnconfigure(0, weight=1)
        
        self.status_label = ctk.CTkLabel(status_bar, text="Ready", 
                                        font=("Arial", 11))
        self.status_label.grid(row=0, column=0, sticky="w", padx=10)
        
        self.progress_bar = ctk.CTkProgressBar(status_bar, height=16, width=200)
        self.progress_bar.grid(row=0, column=1, sticky="e", padx=10)
        self.progress_bar.set(0)
        
    def setup_dashboard_tab(self):
        self.dashboard_tab.grid_columnconfigure(0, weight=1)
        self.dashboard_tab.grid_rowconfigure(1, weight=1)
        
        # Welcome section
        welcome_frame = ctk.CTkFrame(self.dashboard_tab)
        welcome_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkLabel(welcome_frame, 
                    text="🎯 Welcome to GitHub Release Manager",
                    font=("Arial", 18, "bold")).pack(pady=10)
        
        ctk.CTkLabel(welcome_frame, 
                    text="Automate your release workflow with powerful tools",
                    font=("Arial", 12),
                    text_color="gray").pack(pady=(0, 10))
        
        # Quick actions grid
        actions_frame = ctk.CTkFrame(self.dashboard_tab)
        actions_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=10)
        actions_frame.grid_columnconfigure((0, 1, 2), weight=1)
        actions_frame.grid_rowconfigure((0, 1), weight=1)
        
        quick_actions = [
            ("🔨 Safe Build", lambda: self.queue_command(self.safe_build_single), "#4ec9b0"),
            ("🔄 Auto Release", lambda: self.queue_command(self.auto_release), "#007acc"),
            ("✨ Feature Release", lambda: self.queue_command(self.quick_feature_release), "#9b59b6"),
            ("💥 Major Release", lambda: self.queue_command(self.quick_major_release), "#e74c3c"),
            ("📋 List Releases", lambda: self.queue_command(self.list_releases), "#f39c12"),
            ("👀 View Latest", lambda: self.queue_command(self.view_latest_release), "#2ecc71"),
        ]
        
        for i, (text, command, color) in enumerate(quick_actions):
            row = i // 3
            col = i % 3
            
            btn = ctk.CTkButton(actions_frame, text=text, command=command,
                               height=60, font=("Arial", 14, "bold"),
                               fg_color=color, hover_color=self.darken_color(color))
            btn.grid(row=row, column=col, padx=10, pady=10, sticky="nsew")
        
    def setup_quick_tab(self):
        self.quick_tab.grid_columnconfigure(0, weight=1)
        
        # Release type selection
        type_frame = ctk.CTkFrame(self.quick_tab)
        type_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkLabel(type_frame, text="Release Type", 
                    font=("Arial", 16, "bold")).pack(anchor="w", pady=10)
        
        type_options = ctk.CTkFrame(type_frame, fg_color="transparent")
        type_options.pack(fill="x", pady=10)
        
        types = [
            ("🩹 Patch Release", "patch", "Bug fixes and minor improvements"),
            ("✨ Feature Release", "minor", "New features and enhancements"),
            ("💥 Major Release", "major", "Breaking changes and major updates")
        ]
        
        for text, value, description in types:
            rb_frame = ctk.CTkFrame(type_options, fg_color="transparent")
            rb_frame.pack(fill="x", pady=5)
            
            rb = ctk.CTkRadioButton(rb_frame, text=text, variable=self.release_type_var,
                                   value=value, font=("Arial", 12))
            rb.pack(side="left")
            
            ctk.CTkLabel(rb_frame, text=description, font=("Arial", 10),
                        text_color="gray").pack(side="left", padx=10)
        
        # Quick action buttons
        action_frame = ctk.CTkFrame(self.quick_tab)
        action_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkButton(action_frame, text="🚀 Auto Build & Release", 
                     command=lambda: self.queue_command(self.auto_release),
                     height=50, font=("Arial", 16, "bold"),
                     fg_color="#27ae60", hover_color="#219653").pack(pady=20)
        
    def setup_advanced_tab(self):
        self.advanced_tab.grid_columnconfigure(0, weight=1)
        
        # Release details
        details_frame = ctk.CTkFrame(self.advanced_tab)
        details_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkLabel(details_frame, text="Release Details",
                    font=("Arial", 16, "bold")).pack(anchor="w", pady=10)
        
        # Title
        ctk.CTkLabel(details_frame, text="Release Title:").pack(anchor="w", pady=(10, 5))
        title_entry = ctk.CTkEntry(details_frame, textvariable=self.release_title_var,
                                  placeholder_text="Auto-generated if empty")
        title_entry.pack(fill="x", pady=(0, 10))
        
        # Release Notes
        ctk.CTkLabel(details_frame, text="Release Notes:").pack(anchor="w", pady=(10, 5))
        self.notes_text = ctk.CTkTextbox(details_frame, height=150)
        self.notes_text.pack(fill="x", pady=(0, 10))
        
        # Advanced actions
        advanced_actions = ctk.CTkFrame(self.advanced_tab)
        advanced_actions.grid(row=1, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkLabel(advanced_actions, text="Advanced Actions",
                    font=("Arial", 16, "bold")).pack(anchor="w", pady=10)
        
        action_buttons = [
            ("📤 Update Release", lambda: self.queue_command(self.update_release)),
            ("🧹 Clean Build", lambda: self.queue_command(self.clean_build)),
            ("🔄 Refresh Version", lambda: self.queue_command(self.refresh_version)),
            ("🔧 Safe Build", lambda: self.queue_command(self.safe_build_single)),
            ("⚡ Quick Clean", lambda: self.queue_command(self.quick_clean)),
        ]
        
        for text, command in action_buttons:
            btn = ctk.CTkButton(advanced_actions, text=text, command=command)
            btn.pack(fill="x", pady=5)
        
    def setup_releases_tab(self):
        self.releases_tab.grid_columnconfigure(0, weight=1)
        self.releases_tab.grid_rowconfigure(1, weight=1)
        
        # Header
        header_frame = ctk.CTkFrame(self.releases_tab, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkLabel(header_frame, text="Release History",
                    font=("Arial", 16, "bold")).pack(side="left")
        
        ctk.CTkButton(header_frame, text="Refresh", 
                     command=lambda: self.queue_command(self.refresh_releases)).pack(side="right")
        
        # Releases list
        self.releases_frame = ctk.CTkScrollableFrame(self.releases_tab)
        self.releases_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=10)
        
        # Initial placeholder
        ctk.CTkLabel(self.releases_frame, text="Click 'Refresh' to load releases",
                    text_color="gray").pack(pady=20)
        
    def darken_color(self, color, factor=0.8):
        """Darken a hex color"""
        if color.startswith('#'):
            color = color[1:]
            rgb = tuple(int(color[i:i+2], 16) for i in (0, 2, 4))
            new_rgb = [int(c * factor) for c in rgb]
            return f"#{new_rgb[0]:02x}{new_rgb[1]:02x}{new_rgb[2]:02x}"
        return color

    # Command Queue System
    def queue_command(self, command_func):
        """Add command to queue"""
        self.command_queue.put(command_func)
        self.log(f"📋 Queued: {command_func.__name__}", "info")

    def process_command_queue(self):
        """Process commands from queue one by one"""
        try:
            if not self.is_working and not self.command_queue.empty():
                command_func = self.command_queue.get_nowait()
                self.log(f"🚀 Executing: {command_func.__name__}", "info")
                # Execute in thread to avoid freezing GUI
                threading.Thread(target=command_func, daemon=True).start()
        except Empty:
            pass
        finally:
            self.after(100, self.process_command_queue)

    def stop_all_commands(self):
        """Stop all current commands and clear queue"""
        if self.current_command and self.current_command.poll() is None:
            self.current_command.terminate()
            self.log("🛑 All commands stopped", "warning")
        
        # Clear queue
        while not self.command_queue.empty():
            try:
                self.command_queue.get_nowait()
            except Empty:
                break
        
        self.is_working = False
        self.progress_bar.stop()
        self.update_status("Stopped")

    def check_project_selected(self):
        """Check if project path is selected and valid"""
        if not self.project_path_var.get():
            self.log("❌ Please select project path first", "error")
            return False
        
        project_path = Path(self.project_path_var.get())
        if not project_path.exists():
            self.log("❌ Project path does not exist", "error")
            return False
            
        package_json = project_path / "package.json"
        if not package_json.exists():
            self.log("❌ package.json not found in project path", "error")
            return False
            
        return True

    def check_dist_files_exist(self):
        """Check if dist files exist with better detection"""
        if not self.check_project_selected():
            return False
            
        dist_path = Path(self.project_path_var.get()) / "dist"
        
        if not dist_path.exists():
            self.log("❌ dist folder does not exist", "error")
            return False
        
        # Check for various possible executable patterns
        exe_patterns = [
            "MakeYourLifeEasier-*.exe",
            "*.exe",
            "MakeYourLifeEasier*",
            "*.AppImage",
            "*.dmg",
            "*.deb"
        ]
        
        yml_files = list(dist_path.glob("latest.yml"))
        blockmap_files = list(dist_path.glob("*.blockmap"))
        
        # Find any executable files
        exe_files = []
        for pattern in exe_patterns:
            exe_files.extend(dist_path.glob(pattern))
            if exe_files:
                break
        
        has_exe = len(exe_files) > 0
        has_yml = len(yml_files) > 0
        
        if has_exe:
            self.log(f"✅ Found {len(exe_files)} executable files", "success")
            for exe in exe_files[:3]:  # Show first 3 files
                self.log(f"   📄 {exe.name}", "info")
        else:
            self.log("❌ No executable files found in dist folder", "error")
            # List what's actually in dist folder
            if dist_path.exists():
                items = list(dist_path.iterdir())
                if items:
                    self.log("📁 Contents of dist folder:", "info")
                    for item in items:
                        if item.is_dir():
                            self.log(f"   📁 {item.name}/", "info")
                        else:
                            self.log(f"   📄 {item.name}", "info")
        
        if has_yml:
            self.log(f"✅ Found latest.yml", "success")
        else:
            self.log("❌ latest.yml not found", "error")
            
        if blockmap_files:
            self.log(f"✅ Found {len(blockmap_files)} blockmap files", "success")
        
        return has_exe and has_yml
        
    def update_project_status(self):
        """Update project status indicator"""
        if self.check_project_selected():
            self.project_status.configure(
                text="🟢 Project ready", 
                text_color="#27ae60"
            )
        else:
            self.project_status.configure(
                text="🔴 No project selected", 
                text_color="#e74c3c"
            )

    def kill_electron_only(self):
        """Kill only Electron-related processes with proper waiting"""
        self.log("🔫 Killing Electron processes...", "warning")
        
        electron_processes = ["electron.exe", "MakeYourLifeEasier.exe", "node.exe", "app-builder.exe"]
        killed_count = 0
        
        # Try multiple approaches for maximum reliability
        try:
            # Approach 1: Use Windows taskkill (most reliable on Windows)
            self.log("🔫 Using taskkill for forceful termination...", "warning")
            subprocess.run(["taskkill", "/F", "/IM", "electron.exe"], 
                         capture_output=True, timeout=10)
            subprocess.run(["taskkill", "/F", "/IM", "MakeYourLifeEasier.exe"], 
                         capture_output=True, timeout=10)
            subprocess.run(["taskkill", "/F", "/IM", "node.exe"], 
                         capture_output=True, timeout=10)
        except Exception as e:
            self.log(f"⚠️ Taskkill completed: {str(e)}", "warning")
        
        # Wait for processes to terminate
        time.sleep(3)
        
        # Approach 2: Use psutil as backup
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                proc_name = proc.info['name'].lower() if proc.info['name'] else ""
                if any(target in proc_name for target in electron_processes):
                    proc.kill()
                    killed_count += 1
                    self.log(f"✅ Killed: {proc.info['name']} (PID: {proc.info['pid']})", "warning")
            except (psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
                pass
        
        # Additional wait for system to release file locks
        time.sleep(3)
        self.log(f"✅ Killed {killed_count} Electron processes", "success")

    def safe_delete_dist(self, max_retries=3):
        """Safely delete dist folder with retry logic"""
        if not self.check_project_selected():
            return False
            
        dist_path = Path(self.project_path_var.get()) / "dist"
        
        if not dist_path.exists():
            self.log("✅ dist folder doesn't exist - nothing to delete", "success")
            return True
            
        for attempt in range(max_retries):
            try:
                # Kill processes before each attempt
                self.kill_electron_only()
                
                # Use shutil for more robust deletion
                shutil.rmtree(dist_path)
                self.log("✅ Successfully deleted dist folder", "success")
                return True
            except Exception as e:
                self.log(f"⚠️ Delete attempt {attempt + 1} failed: {str(e)}", "warning")
                if attempt < max_retries - 1:
                    time.sleep(3)  # Wait before retry
                    # Kill processes again
                    self.kill_electron_only()
                else:
                    self.log("❌ Failed to delete dist folder after multiple attempts", "error")
                    return False
        return False

    def find_file_lockers(self):
        """Find which processes are locking files in dist folder"""
        if not self.check_project_selected():
            return
            
        dist_path = Path(self.project_path_var.get()) / "dist"
        
        if not dist_path.exists():
            self.log("ℹ️ dist folder doesn't exist", "info")
            return
            
        self.log("🔍 Searching for processes locking dist files...", "info")
        
        try:
            # Use Handle.exe (SysInternals) to find file locks
            result = subprocess.run(
                ["handle", dist_path],
                capture_output=True, 
                text=True, 
                timeout=30
            )
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                if len(lines) > 1:
                    self.log("🔒 Found these processes locking files:", "warning")
                    for line in lines:
                        if line.strip():
                            self.log(f"   {line}", "warning")
                else:
                    self.log("✅ No processes found locking dist files", "success")
            else:
                self.log("ℹ️ No file locks detected or handle.exe not available", "info")
                
        except FileNotFoundError:
            self.log("📥 handle.exe not found. Installing SysInternals...", "info")
            # You can download handle.exe from SysInternals
            self.log("💡 Download handle.exe from: https://learn.microsoft.com/en-us/sysinternals/downloads/handle", "info")
        except Exception as e:
            self.log(f"❌ Error checking file locks: {e}", "error")

    def quick_clean(self):
        """Quick cleanup without nuclear option"""
        self.log("🧹 Quick cleanup...", "info")
        
        # Kill electron processes
        self.kill_electron_only()
        
        # Clean dist folder with retry logic
        self.safe_delete_dist()
        time.sleep(2)

    def safe_build_single(self):
        """Safe build as single command with better build command detection"""
        if not self.check_project_selected():
            return False
            
        self.log("🛡️ Starting safe build...", "info")
        
        # Kill processes and clean with retry logic
        self.kill_electron_only()
        
        if not self.safe_delete_dist():
            self.log("❌ Cannot proceed with build - cleanup failed", "error")
            return False
            
        time.sleep(2)
        
        # Try different build commands sequentially
        build_commands = [
            "npm run build-all",
            "npm run build-portable", 
            "npm run build-installer",
            "npm run build",
            "npm run dist",
            "npm run electron:build",
            "npx electron-builder",
            "npm run make"
        ]
        
        # Check which build command exists in package.json
        package_json_path = Path(self.project_path_var.get()) / "package.json"
        available_scripts = []
        if package_json_path.exists():
            with open(package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
                scripts = package_data.get('scripts', {})
                
                self.log("📋 Available build scripts:", "info")
                for script_name, script_command in scripts.items():
                    if any(keyword in script_name.lower() for keyword in ['build', 'dist', 'make', 'electron']):
                        self.log(f"   🛠️ {script_name}: {script_command}", "info")
                        available_scripts.append(script_name)
        
        # Try build commands in order, prioritizing available scripts
        success = False
        for build_cmd in build_commands:
            # Extract script name from command (e.g., "npm run build-all" -> "build-all")
            script_name = build_cmd.replace("npm run ", "").replace("npx ", "")
            
            # Skip if this script doesn't exist in package.json (unless it's npx command)
            if build_cmd.startswith("npm run ") and script_name not in available_scripts:
                self.log(f"⏭️  Skipping {build_cmd} - script not found", "info")
                continue
                
            self.log(f"🛠️ Trying build command: {build_cmd}", "info")
            success = self.run_command_in_thread(build_cmd, require_project=True)
            if success:
                # Wait a bit for files to be written
                time.sleep(5)
                # Check if build actually produced files
                if self.check_dist_files_exist():
                    self.log("✅ Build completed successfully with files generated", "success")
                    break
                else:
                    self.log("⚠️ Build command succeeded but no dist files created", "warning")
                    success = False
            else:
                self.log(f"❌ Build command failed: {build_cmd}", "error")
        
        if success:
            self.log("✅ Build process completed successfully", "success")
            return True
        else:
            self.log("❌ All build attempts failed", "error")
            return False

    def run_command_in_thread(self, command, cwd=None, require_project=True):
        """Run command in separate thread and wait for completion"""
        if require_project and not self.check_project_selected():
            return False
            
        self.is_working = True
        self.progress_bar.start()
        self.update_status("Working...")
        
        result_container = [None]  # Use list to store result across threads
        
        def execute():
            try:
                working_dir = cwd
                if working_dir is None and require_project:
                    working_dir = self.project_path_var.get()
                
                self.after(0, lambda: self.log(f"▶️  Running: {command}", "info"))
                
                process = subprocess.run(
                    command, 
                    shell=True, 
                    capture_output=True, 
                    text=True, 
                    cwd=working_dir
                )
                
                output = process.stdout + process.stderr
                
                if process.returncode == 0:
                    self.after(0, lambda: self.log(output, "output"))
                    self.after(0, lambda: self.log("✅ Command completed successfully", "success"))
                    self.after(0, lambda: self.update_status("Command completed"))
                    result_container[0] = True
                else:
                    self.after(0, lambda: self.log(output, "error"))
                    self.after(0, lambda: self.log(f"❌ Command failed with return code: {process.returncode}", "error"))
                    self.after(0, lambda: self.update_status("Command failed"))
                    result_container[0] = False
                    
            except Exception as e:
                error_msg = f"❌ Error executing command: {str(e)}"
                self.after(0, lambda: self.log(error_msg, "error"))
                self.after(0, lambda: self.update_status("Error occurred"))
                result_container[0] = False
            finally:
                self.after(0, self.command_finished)
        
        # Start thread and wait for completion
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()
        thread.join()  # Wait for thread to complete
        
        return result_container[0]

    def auto_release(self):
        """Automatically build and release with better flow control"""
        if not self.check_project_selected():
            return
            
        self.log("🚀 Starting auto build & release...", "info")
        
        # Step 1: Build
        if self.safe_build_single():
            # Wait longer for build to complete and files to be ready
            self.log("⏳ Build successful, waiting for file stabilization...", "info")
            time.sleep(5)
            
            # Double check files exist
            if self.check_dist_files_exist():
                self.log("✅ Files confirmed, creating release...", "success")
                self.create_release()
            else:
                self.log("❌ Build succeeded but dist files are missing", "error")
                self.log("💡 Try running build manually to see what's happening", "info")
        else:
            self.log("❌ Auto release failed - build unsuccessful", "error")

    def create_release_after_build(self):
        """Create release after successful build"""
        if not self.check_dist_files_exist():
            self.log("❌ Cannot create release - dist files missing", "error")
            return
            
        self.create_release()

    def run_single_command(self, command, cwd=None, require_project=True):
        """Run a single command without queue (for internal use) - NON BLOCKING"""
        if self.is_working:
            self.log("⚠️ Another command is already running", "warning")
            return False
            
        if require_project and not self.check_project_selected():
            return False
            
        self.is_working = True
        self.progress_bar.start()
        self.update_status("Working...")
        
        def execute():
            try:
                working_dir = cwd
                if working_dir is None and require_project:
                    working_dir = self.project_path_var.get()
                
                self.after(0, lambda: self.log(f"▶️  Running: {command}", "info"))
                
                self.current_command = subprocess.run(
                    command, 
                    shell=True, 
                    capture_output=True, 
                    text=True, 
                    cwd=working_dir
                )
                
                output = self.current_command.stdout + self.current_command.stderr
                
                if self.current_command.returncode == 0:
                    self.after(0, lambda: self.log(output, "output"))
                    self.after(0, lambda: self.log("✅ Command completed successfully", "success"))
                    self.after(0, lambda: self.update_status("Command completed"))
                    result = True
                else:
                    self.after(0, lambda: self.log(output, "error"))
                    self.after(0, lambda: self.log(f"❌ Command failed with return code: {self.current_command.returncode}", "error"))
                    self.after(0, lambda: self.update_status("Command failed"))
                    result = False
                    
            except Exception as e:
                error_msg = f"❌ Error executing command: {str(e)}"
                self.after(0, lambda: self.log(error_msg, "error"))
                self.after(0, lambda: self.update_status("Error occurred"))
                result = False
            finally:
                self.after(0, self.command_finished)
                
            return result
                
        threading.Thread(target=execute, daemon=True).start()
        return True

    def command_finished(self):
        self.is_working = False
        self.current_command = None
        self.progress_bar.stop()
        
    def update_status(self, message):
        self.status_label.configure(text=message)
        
    def log(self, message, message_type="info"):
        if not message.strip():
            return
            
        timestamp = self.get_timestamp()
        
        self.console_text.insert("end", f"[{timestamp}] ", "timestamp")
        self.console_text.insert("end", f"{message}\n", message_type)
        
        self.console_text.see("end")
        self.update_idletasks()
        
    def get_timestamp(self):
        return datetime.now().strftime("%H:%M:%S")
        
    def clear_console(self):
        self.console_text.delete("1.0", "end")
        
    def copy_console(self):
        content = self.console_text.get("1.0", "end")
        self.clipboard_clear()
        self.clipboard_append(content)
        self.log("📋 Console output copied to clipboard", "success")
        
    # Navigation methods
    def show_dashboard(self):
        self.tabview.set("📊 Dashboard")
        
    def show_quick_release(self):
        self.tabview.set("⚡ Quick Release")
        
    def show_advanced(self):
        self.tabview.set("🔧 Advanced")
        
    def show_releases(self):
        self.tabview.set("📋 Releases")
        self.refresh_releases()
        
    # Command methods
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
        except:
            return "1.0.0"
            
    def build_project(self):
        """Legacy build - use safe_build_single instead"""
        self.queue_command(self.safe_build_single)
        
    def create_release(self):
        """Create release (assumes build is already done)"""
        if not self.check_project_selected():
            return
            
        if not self.check_dist_files_exist():
            self.log("❌ No executable files found in dist folder. Build first!", "error")
            if messagebox.askyesno("Build Required", "No executable files found. Run build first?"):
                self.queue_command(self.auto_release)
            return
            
        current_version = self.version_var.get()
        release_type = self.release_type_var.get()
        new_version = self.calculate_new_version(current_version, release_type)
        
        # Auto-fill title
        if not self.release_title_var.get():
            titles = {
                "patch": f"v{new_version} - Bug Fixes",
                "minor": f"v{new_version} - New Features", 
                "major": f"v{new_version} - Major Update"
            }
            self.release_title_var.set(titles[release_type])
        
        # Auto-fill notes
        notes = self.notes_text.get("1.0", "end").strip()
        if not notes:
            notes_templates = {
                "patch": "Minor bug fixes and improvements",
                "minor": "## New Features\n- Feature 1\n- Feature 2\n\n## Improvements\n- Improvement 1",
                "major": "## Breaking Changes\n- Change 1\n- Change 2\n\n## New Features\n- Major feature 1"
            }
            self.notes_text.delete("1.0", "end")
            self.notes_text.insert("1.0", notes_templates[release_type])
            notes = notes_templates[release_type]
        
        release_command = (
            f'gh release create v{new_version} '
            f'./dist/MakeYourLifeEasier-*.exe ./dist/latest.yml '
            f'--title "{self.release_title_var.get()}" '
            f'--notes "{notes}"'
        )
        
        success = self.run_command_in_thread(release_command, require_project=True)
        if success:
            self.version_var.set(new_version)
            self.log(f"🎉 Release v{new_version} created successfully!", "success")
            
    def update_release(self):
        if not self.check_project_selected():
            return
            
        if not self.check_dist_files_exist():
            self.log("❌ No executable files found in dist folder. Build first!", "error")
            return
            
        version = self.version_var.get()
        self.run_command_in_thread(f'gh release upload v{version} ./dist/MakeYourLifeEasier-*.exe ./dist/latest.yml --clobber', 
                        require_project=True)
        
    def list_releases(self):
        self.run_command_in_thread("gh release list", require_project=False)
        self.show_releases()
        
    def view_latest_release(self):
        self.run_command_in_thread(f"gh release view v{self.version_var.get()}", require_project=False)
        
    def quick_patch_release(self):
        """Quick patch release with auto build"""
        if not self.check_project_selected():
            return
        self.release_type_var.set("patch")
        self.queue_command(self.auto_release)
        
    def quick_feature_release(self):
        """Quick feature release with auto build"""
        if not self.check_project_selected():
            return
        self.release_type_var.set("minor") 
        self.queue_command(self.auto_release)
        
    def quick_major_release(self):
        """Quick major release with auto build"""
        if not self.check_project_selected():
            return
        self.release_type_var.set("major")
        self.queue_command(self.auto_release)
        
    def clean_build(self):
        """Clean build using safe deletion"""
        self.safe_delete_dist()

    def refresh_version(self):
        if not self.check_project_selected():
            return
        self.load_package_json(self.project_path_var.get())
            
    def refresh_releases(self):
        def fetch_releases():
            try:
                result = subprocess.run(
                    "gh release list", 
                    shell=True, 
                    capture_output=True, 
                    text=True
                )
                self.after(0, lambda: self.display_releases(result.stdout))
            except Exception as e:
                self.after(0, lambda: self.log(f"❌ Error fetching releases: {e}", "error"))
                
        threading.Thread(target=fetch_releases, daemon=True).start()
        
    def display_releases(self, releases_output):
        # Clear existing releases
        for widget in self.releases_frame.winfo_children():
            widget.destroy()
            
        if not releases_output.strip():
            ctk.CTkLabel(self.releases_frame, text="No releases found",
                        text_color="gray").pack(pady=20)
            return
            
        releases = releases_output.strip().split('\n')
        for i, release in enumerate(releases):
            release_frame = ctk.CTkFrame(self.releases_frame)
            release_frame.pack(fill="x", pady=5, padx=5)
            
            # Parse release info
            parts = [part for part in release.split('\t') if part.strip()]
            if len(parts) >= 3:
                title = parts[0]
                tag = parts[2]
                date = parts[3] if len(parts) > 3 else ""
                
                # Title
                ctk.CTkLabel(release_frame, text=title, 
                            font=("Arial", 12, "bold")).pack(anchor="w", pady=(5, 0))
                
                # Info frame
                info_frame = ctk.CTkFrame(release_frame, fg_color="transparent")
                info_frame.pack(fill="x", pady=2)
                
                # Tag and date
                ctk.CTkLabel(info_frame, text=f"Tag: {tag}", 
                            font=("Arial", 10), text_color="gray").pack(side="left")
                
                if date:
                    ctk.CTkLabel(info_frame, text=f"Date: {date}", 
                                font=("Arial", 10), text_color="gray").pack(side="left", padx=(10, 0))
                
                # Latest badge
                if "Latest" in release:
                    ctk.CTkLabel(info_frame, text="LATEST", 
                                text_color="#27ae60", font=("Arial", 9, "bold")).pack(side="right")

    def load_initial_state(self):
        """Load initial data"""
        self.refresh_releases()
        
    def browse_project_path(self):
        path = filedialog.askdirectory()
        if path:
            self.project_path_var.set(path)
            self.path_label.configure(text=path)
            self.load_package_json(path)
            self.update_project_status()
            self.update_status("Project loaded successfully")
            
    def load_package_json(self, path):
        package_json_path = Path(path) / "package.json"
        if package_json_path.exists():
            try:
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    package_data = json.load(f)
                    current_version = package_data.get('version', 'Unknown')
                    self.version_var.set(current_version)
                    self.log(f"📋 Loaded version: {current_version}", "success")
            except Exception as e:
                self.log(f"❌ Error loading package.json: {e}", "error")

if __name__ == "__main__":
    try:
        import psutil
    except ImportError:
        print("Installing psutil...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
        import psutil
        
    app = ModernReleaseManager()
    app.mainloop()