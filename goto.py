#!/usr/bin/env python3
"""
GO TO - Fast Navigation dengan Keyboard Arrow
Gunakan ↑ ↓ untuk pilih, Enter untuk buka
"""

import os
import sys
import subprocess
from pathlib import Path

# Coba import keyboard, kalo ga ada install
try:
    import keyboard
except ImportError:
    print("⚠️  Library 'keyboard' tidak ditemukan. Menginstall...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "keyboard"])
    import keyboard

class GoTo:
    def __init__(self):
        self.project_root = os.getcwd()
        self.menu_items = []
        self.selected_index = 0
        self.scroll_offset = 0
        
    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def build_menu(self):
        """Build menu items"""
        self.menu_items = [
            # Header
            ("📁 SRC", None, None),
            ("  src", "src", "folder"),
            ("  auth", "src/auth", "folder"),
            ("  api", "src/api", "folder"),
            ("  hooks", "src/hooks", "folder"),
            ("  utils", "src/utils", "folder"),
            ("  styles", "src/styles", "folder"),
            ("", None, None),  # separator
            
            ("📁 COMPONENTS", None, None),
            ("  components", "src/components", "folder"),
            ("  pages", "src/components/pages", "folder"),
            ("  layout", "src/components/layout", "folder"),
            ("  common", "src/components/common", "folder"),
            ("", None, None),
            
            ("📄 PAGES", None, None),
            ("  dashboard", "src/components/pages/Dashboard", "folder"),
            ("  import", "src/components/pages/Import", "folder"),
            ("  master", "src/components/pages/Master", "folder"),
            ("  mapping", "src/components/pages/Mapping", "folder"),
            ("  opname", "src/components/pages/Opname", "folder"),
            ("  progress", "src/components/pages/Progress", "folder"),
            ("  history", "src/components/pages/History", "folder"),
            ("  petugas", "src/components/pages/PetugasDashboard", "folder"),
            ("", None, None),
            
            ("🔧 LAYOUT", None, None),
            ("  sidebar", "src/components/layout/Sidebar", "folder"),
            ("  topbar", "src/components/layout/Topbar", "folder"),
            ("  statusbar", "src/components/layout/StatusBar", "folder"),
            ("  privatelayout", "src/components/layout/PrivateLayout", "folder"),
            ("", None, None),
            
            ("🔐 AUTH", None, None),
            ("  login", "src/auth/components/LoginPage", "folder"),
            ("  authcontext", "src/auth/contexts", "folder"),
            ("  authservice", "src/auth/services", "folder"),
            ("", None, None),
            
            ("📄 FILES", None, None),
            ("  app", "src/App.tsx", "file"),
            ("  main", "src/main.tsx", "file"),
            ("  index", "src/index.html", "file"),
            ("  vite", "vite.config.ts", "file"),
            ("  package", "package.json", "file"),
            ("", None, None),
            
            ("🔍 SEARCH", "search", "action"),
            ("🚪 EXIT", "exit", "action"),
        ]
        
        # Reset selected index ke item pertama yang bisa dipilih
        for i, item in enumerate(self.menu_items):
            if item[1] is not None and item[0].strip():
                self.selected_index = i
                break
    
    def print_menu(self):
        """Print menu dengan highlight"""
        self.clear_screen()
        
        print("=" * 60)
        print("  🚀 GO TO - Fast Navigation")
        print("  Gunakan ↑ ↓ untuk pilih, Enter untuk buka")
        print("=" * 60)
        print()
        
        # Tampilkan menu
        visible_items = 20  # Jumlah item yang terlihat
        start_idx = max(0, self.selected_index - visible_items // 2)
        end_idx = min(len(self.menu_items), start_idx + visible_items)
        
        for i in range(start_idx, end_idx):
            label, path, item_type = self.menu_items[i]
            
            # Separator
            if label == "":
                print("  " + "-" * 56)
                continue
            
            # Header (gak bisa dipilih)
            if path is None:
                print(f"\n  {label}")
                continue
            
            # Item
            is_selected = (i == self.selected_index)
            prefix = "▸ " if is_selected else "  "
            icon = "📁" if item_type == "folder" else "📄" if item_type == "file" else "🔍"
            
            # Tampilkan path di samping
            if is_selected:
                print(f"  {prefix}\033[1;33m{label:<20}\033[0m → \033[1;37m{path}\033[0m")
            else:
                print(f"  {prefix}{label:<20} → {path}")
        
        # Info footer
        print()
        print("=" * 60)
        print(f"  Total: {len([i for i in self.menu_items if i[1] is not None and i[0].strip()])} items")
        print("  ↑ ↓ = pilih  |  Enter = buka  |  q = keluar")
        print("=" * 60)
    
    def get_selected_item(self):
        """Dapatkan item yang dipilih"""
        if 0 <= self.selected_index < len(self.menu_items):
            label, path, item_type = self.menu_items[self.selected_index]
            if path is not None:
                return label, path, item_type
        return None, None, None
    
    def move_up(self):
        """Pindah ke atas (skip header & separator)"""
        for i in range(self.selected_index - 1, -1, -1):
            label, path, _ = self.menu_items[i]
            if path is not None and label.strip():
                self.selected_index = i
                return
    
    def move_down(self):
        """Pindah ke bawah (skip header & separator)"""
        for i in range(self.selected_index + 1, len(self.menu_items)):
            label, path, _ = self.menu_items[i]
            if path is not None and label.strip():
                self.selected_index = i
                return
    
    def open_path(self, path):
        """Buka file/folder di VS Code"""
        if path == "exit":
            print("\n👋 Bye!")
            sys.exit(0)
        
        if path == "search":
            self.search_mode()
            return
        
        full_path = os.path.join(self.project_root, path)
        if os.path.exists(full_path):
            print(f"\n📂 Membuka: {full_path}")
            if os.name == 'nt':
                subprocess.run(['code', full_path], shell=True)
            else:
                subprocess.run(['code', full_path])
            
            # Tunggu sebentar lalu kembali ke menu
            input("\n✅ Sudah dibuka. Tekan Enter untuk kembali ke menu...")
            self.run()
        else:
            print(f"\n❌ Tidak ditemukan: {full_path}")
            input("\nTekan Enter untuk kembali...")
            self.run()
    
    def search_mode(self):
        """Mode search"""
        self.clear_screen()
        print("=" * 60)
        print("  🔍 SEARCH MODE")
        print("=" * 60)
        print()
        
        query = input("Cari: ").strip()
        if not query:
            self.run()
            return
        
        # Cari di src
        matches = []
        src_path = os.path.join(self.project_root, 'src')
        
        if os.path.exists(src_path):
            for root, dirs, files in os.walk(src_path):
                for name in dirs + files:
                    if query.lower() in name.lower():
                        rel_path = os.path.relpath(os.path.join(root, name), self.project_root)
                        matches.append((name, rel_path))
        
        # Cari di root juga
        for f in os.listdir(self.project_root):
            if query.lower() in f.lower() and f not in ['src', 'node_modules']:
                matches.append((f, f))
        
        if matches:
            print(f"\n📁 Ditemukan {len(matches)} hasil:")
            for i, (name, path) in enumerate(matches, 1):
                print(f"  {i}. {name}")
            
            print("\n  0. Batal")
            choice = input("\nPilih nomor: ").strip()
            
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(matches):
                    self.open_path(matches[idx][1])
                else:
                    self.run()
            except:
                self.run()
        else:
            print(f"❌ Tidak ditemukan: {query}")
            input("\nTekan Enter untuk kembali...")
            self.run()
    
    def run(self):
        """Main loop"""
        self.build_menu()
        
        # Install keyboard handler
        print("🔧 Press ↑ ↓ to navigate, Enter to select, q to quit")
        print()
        
        while True:
            self.print_menu()
            
            try:
                # Tunggu input keyboard
                event = keyboard.read_event()
                
                if event.event_type == 'down':
                    if event.name == 'up':
                        self.move_up()
                    elif event.name == 'down':
                        self.move_down()
                    elif event.name == 'enter':
                        label, path, _ = self.get_selected_item()
                        if path:
                            self.open_path(path)
                    elif event.name == 'q':
                        print("\n👋 Bye!")
                        sys.exit(0)
            except KeyboardInterrupt:
                print("\n👋 Bye!")
                sys.exit(0)
            except Exception as e:
                print(f"\n❌ Error: {e}")
                input("Tekan Enter untuk lanjut...")

if __name__ == '__main__':
    go = GoTo()
    go.run()