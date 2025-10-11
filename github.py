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
        
        self.title("🚀 GitHub Release Manager - Simplified")
        self.geometry("1000x700")
        self.minsize(800, 600)
        
        # Variables
        self.version_var = ctk.StringVar(value="1.0.0")
        self.release_type_var = ctk.StringVar(value="patch")
        self.release_title_var = ctk.StringVar()
        self.project_path_var = ctk.StringVar()
        self.is_working = False
        self.current_command = None
        self.command_queue = Queue()
        
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
        sidebar = ctk.CTkFrame(self, width=200, corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        sidebar.grid_rowconfigure(4, weight=1)
        
        # Project Section
        project_section = ctk.CTkFrame(sidebar, fg_color="transparent")
        project_section.grid(row=0, column=0, sticky="ew", padx=15, pady=10)
        
        ctk.CTkLabel(project_section, text="PROJECT", 
                    font=("Arial", 12, "bold"), text_color="gray").pack(anchor="w")
        
        # Project Path
        path_frame = ctk.CTkFrame(project_section, fg_color="transparent")
        path_frame.pack(fill="x", pady=5)
        
        ctk.CTkButton(path_frame, text="📁 Select Project", 
                     command=self.browse_project_path,
                     width=120).pack(fill="x")
        
        self.path_label = ctk.CTkLabel(path_frame, text="No project selected",
                    font=("Arial", 10), text_color="gray", wraplength=180)
        self.path_label.pack(fill="x", pady=(5, 0))
        
        # Version Info
        version_frame = ctk.CTkFrame(project_section, fg_color="transparent")
        version_frame.pack(fill="x", pady=5)
        
        ctk.CTkLabel(version_frame, text="Current Version:").pack(anchor="w")
        self.version_display = ctk.CTkLabel(version_frame, textvariable=self.version_var,
                    font=("Arial", 16, "bold"))
        self.version_display.pack(fill="x", pady=5)
        
        # Project Status
        self.project_status = ctk.CTkLabel(project_section, 
                                         text="🔴 No project selected",
                                         font=("Arial", 10), 
                                         text_color="#e74c3c")
        self.project_status.pack(anchor="w", pady=5)
        
        # Navigation
        nav_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        nav_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=20)
        
        nav_buttons = [
            ("📋 View Releases", self.show_releases),
            ("⚡ Quick Releases", self.show_quick_release),
            ("🔧 Advanced", self.show_advanced),
        ]
        
        for text, command in nav_buttons:
            btn = ctk.CTkButton(nav_frame, text=text, command=command,
                               fg_color="transparent", hover_color=("gray70", "gray30"),
                               anchor="w", height=35)
            btn.pack(fill="x", pady=2)
        
    def create_main_content(self):
        main_content = ctk.CTkFrame(self, corner_radius=10)
        main_content.grid(row=0, column=1, sticky="nsew", padx=(0, 10), pady=10)
        main_content.grid_columnconfigure(0, weight=1)
        main_content.grid_rowconfigure(1, weight=1)
        
        # Tabview for different sections
        self.tabview = ctk.CTkTabview(main_content)
        self.tabview.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        # Create tabs
        self.releases_tab = self.tabview.add("📋 Releases")
        self.quick_tab = self.tabview.add("⚡ Quick Releases")
        self.advanced_tab = self.tabview.add("🔧 Advanced")
        
        self.setup_releases_tab()
        self.setup_quick_tab()
        self.setup_advanced_tab()
        
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
        ctk.CTkButton(console_controls, text="Stop", width=100,
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
            ("🩹 Patch", "patch", "Bug fixes"),
            ("✨ Minor", "minor", "New features"),
            ("💥 Major", "major", "Breaking changes")
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
        
        ctk.CTkButton(action_frame, text="🚀 Quick Release", 
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
        self.title_entry = ctk.CTkEntry(details_frame, textvariable=self.release_title_var,
                                       placeholder_text="Auto-generated if empty")
        self.title_entry.pack(fill="x", pady=(0, 10))
        
        # Release Notes
        ctk.CTkLabel(details_frame, text="Release Notes:").pack(anchor="w", pady=(10, 5))
        self.notes_text = ctk.CTkTextbox(details_frame, height=150)
        self.notes_text.pack(fill="x", pady=(0, 10))
        
        # Advanced actions
        advanced_actions = ctk.CTkFrame(self.advanced_tab)
        advanced_actions.grid(row=1, column=0, sticky="ew", padx=10, pady=10)
        
        ctk.CTkLabel(advanced_actions, text="Actions",
                    font=("Arial", 16, "bold")).pack(anchor="w", pady=10)
        
        action_buttons = [
            ("📤 Update Release", self.update_release),
            ("🗑️ Delete Release", self.delete_current_tag),
            ("➕ Create Release", lambda: self.queue_command(self.create_release)),
        ]
        
        for text, command in action_buttons:
            btn = ctk.CTkButton(advanced_actions, text=text, command=command)
            btn.pack(fill="x", pady=5)
        
    # Command Queue System
    def queue_command(self, command_func):
        self.command_queue.put(command_func)
        self.log(f"📋 Queued: {command_func.__name__}", "info")

    def process_command_queue(self):
        try:
            if not self.is_working and not self.command_queue.empty():
                command_func = self.command_queue.get_nowait()
                self.log(f"🚀 Executing: {command_func.__name__}", "info")
                threading.Thread(target=command_func, daemon=True).start()
        except Empty:
            pass
        finally:
            self.after(100, self.process_command_queue)

    def stop_all_commands(self):
        if self.current_command and self.current_command.poll() is None:
            self.current_command.terminate()
            self.log("🛑 Commands stopped", "warning")
        
        while not self.command_queue.empty():
            try:
                self.command_queue.get_nowait()
            except Empty:
                break
        
        self.is_working = False
        self.progress_bar.stop()
        self.update_status("Stopped")

    def check_project_selected(self):
        if not self.project_path_var.get():
            self.log("❌ Select project path first", "error")
            return False
        
        project_path = Path(self.project_path_var.get())
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
            
        project_path = Path(self.project_path_var.get())
        git_dir = project_path / ".git"
        
        if not git_dir.exists():
            self.log("❌ Not a git repository", "error")
            return False
            
        return True

    def check_dist_files_exist(self):
        if not self.check_project_selected():
            return False
            
        dist_path = Path(self.project_path_var.get()) / "dist"
        
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
                self.project_status.configure(text="🟢 Ready (Git)", text_color="#27ae60")
            else:
                self.project_status.configure(text="🟡 Ready (No Git)", text_color="#f39c12")
        else:
            self.project_status.configure(text="🔴 No project", text_color="#e74c3c")

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
        dist_path = Path(self.project_path_var.get()) / "dist"
        
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
        
        package_json_path = Path(self.project_path_var.get()) / "package.json"
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
            if self.run_command_in_thread(build_cmd):
                time.sleep(5)
                if self.check_dist_files_exist():
                    success = True
                    break
        return success

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
        self.progress_bar.start()
        self.update_status("Working...")
        
        def execute():
            try:
                working_dir = cwd or (self.project_path_var.get() if require_project else None)
                self.after(0, lambda: self.log(f"▶️ {command}", "info"))
                
                process = subprocess.run(command, shell=True, capture_output=True, text=True, cwd=working_dir)
                output = process.stdout + process.stderr
                
                if process.returncode == 0:
                    self.after(0, lambda: self.log(output, "output"))
                    self.after(0, lambda: self.log("✅ Success", "success"))
                    result = True
                else:
                    self.after(0, lambda: self.log(output, "error"))
                    self.after(0, lambda: self.log(f"❌ Failed: {process.returncode}", "error"))
                    result = False
                    
            except Exception as e:
                self.after(0, lambda: self.log(f"❌ Error: {str(e)}", "error"))
                result = False
            finally:
                self.after(0, self.command_finished)
                if callback:
                    self.after(0, lambda: callback(result))
            
            return result
        
        threading.Thread(target=execute, daemon=True).start()
        return True

    def run_command_in_thread(self, command, cwd=None, require_project=True, check_git=False):
        result_container = [None]
        event = threading.Event()
        
        def callback(result):
            result_container[0] = result
            event.set()
        
        success = self.run_command_async(command, cwd, require_project, check_git, callback)
        if not success:
            return False
            
        event.wait(300)
        return result_container[0] if result_container[0] is not None else False

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
            return
            
        current_version = self.version_var.get()
        release_type = self.release_type_var.get()
        new_version = self.calculate_new_version(current_version, release_type)
        
        release_title = self.release_title_var.get().strip() or f"v{new_version} - {release_type.capitalize()}"
        release_notes = self.notes_text.get("1.0", "end-1c").strip() or f"{release_type.capitalize()} release"
        
        temp_notes_file = Path(self.project_path_var.get()) / "temp_release_notes.md"
        try:
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            release_command = f'gh release create v{new_version} ./dist/*.exe ./dist/latest.yml ./dist/*.blockmap --title "{release_title}" --notes-file "{temp_notes_file}"'
            success = self.run_command_in_thread(release_command, check_git=True)
            
            temp_notes_file.unlink()
            
            if success:
                self.version_var.set(new_version)
                self.log(f"🎉 v{new_version} created!", "success")
        except Exception as e:
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
            return
            
        version = self.version_var.get()
        release_title = self.release_title_var.get().strip()
        release_notes = self.notes_text.get("1.0", "end-1c").strip()
        
        if not release_title or not release_notes:
            self.log("❌ Enter title and notes", "error")
            return
        
        temp_notes_file = Path(self.project_path_var.get()) / "temp_release_notes.md"
        try:
            with open(temp_notes_file, 'w', encoding='utf-8') as f:
                f.write(release_notes)
            
            update_command = f'gh release edit v{version} --title "{release_title}" --notes-file "{temp_notes_file}"'
            metadata_success = self.run_command_in_thread(update_command, check_git=True)
            
            temp_notes_file.unlink()
            
            if metadata_success:
                upload_command = f'gh release upload v{version} ./dist/*.exe ./dist/latest.yml ./dist/*.blockmap --clobber'
                if self.run_command_in_thread(upload_command, check_git=True):
                    self.log(f"✅ v{version} updated!", "success")
        except Exception as e:
            self.log(f"❌ Error: {e}", "error")

    def delete_current_tag(self):
        if not self.check_git_repository():
            return
            
        version = self.version_var.get()
        if not version:
            self.log("❌ No version", "error")
            return
        
        if not messagebox.askyesno("Confirm", f"Delete v{version}?"):
            return
        
        release_delete_cmd = f'gh release delete v{version} --yes'
        self.run_command_in_thread(release_delete_cmd, check_git=True)
        
        tag_delete_cmd = f'git tag -d v{version}'
        self.run_command_in_thread(tag_delete_cmd, check_git=True)
        
        push_cmd = f'git push origin --delete v{version}'
        self.run_command_in_thread(push_cmd, check_git=True)
        
        self.refresh_releases()

    def refresh_releases(self):
        cwd = self.project_path_var.get() if self.check_git_repository() else None
        result = subprocess.run("gh release list", shell=True, capture_output=True, text=True, cwd=cwd)
        self.after(0, lambda: self.display_releases(result.stdout))

    def display_releases(self, releases_output):
        for widget in self.releases_frame.winfo_children():
            widget.destroy()
            
        if not releases_output.strip():
            ctk.CTkLabel(self.releases_frame, text="No releases", text_color="gray").pack(pady=20)
            return
            
        releases = releases_output.strip().split('\n')
        for release in releases:
            parts = [part.strip() for part in release.split('\t') if part.strip()]
            if len(parts) >= 3:
                title, _, tag, *rest = parts
                date = rest[0] if rest else ""
                
                release_frame = ctk.CTkFrame(self.releases_frame)
                release_frame.pack(fill="x", pady=5)
                
                ctk.CTkLabel(release_frame, text=title, font=("Arial", 12, "bold")).pack(anchor="w")
                ctk.CTkLabel(release_frame, text=f"Tag: {tag} | Date: {date}", font=("Arial", 10), text_color="gray").pack(anchor="w")

    def command_finished(self):
        self.is_working = False
        self.current_command = None
        self.progress_bar.stop()

    def update_status(self, message):
        self.status_label.configure(text=message)
        
    def log(self, message, message_type="info"):
        if not message.strip():
            return
            
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.console_text.insert("end", f"[{timestamp}] {message}\n", message_type)
        self.console_text.see("end")
        
    def clear_console(self):
        self.console_text.delete("1.0", "end")
        
    def copy_console(self):
        content = self.console_text.get("1.0", "end")
        self.clipboard_clear()
        self.clipboard_append(content)
        self.log("📋 Copied", "success")
        
    # Navigation methods
    def show_releases(self):
        self.tabview.set("📋 Releases")
        self.refresh_releases()
        
    def show_quick_release(self):
        self.tabview.set("⚡ Quick Releases")
        
    def show_advanced(self):
        self.tabview.set("🔧 Advanced")
        
    def load_initial_state(self):
        self.refresh_releases()
        
    def browse_project_path(self):
        path = filedialog.askdirectory()
        if path:
            self.project_path_var.set(path)
            self.path_label.configure(text=path)
            self.load_package_json(path)
            self.update_project_status()
            
    def load_package_json(self, path):
        package_json_path = Path(path) / "package.json"
        if package_json_path.exists():
            try:
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.version_var.set(data.get('version', 'Unknown'))
            except Exception as e:
                self.log(f"❌ package.json error: {e}", "error")

if __name__ == "__main__":
    try:
        import psutil
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
        import psutil
        
    app = ModernReleaseManager()
    app.mainloop()