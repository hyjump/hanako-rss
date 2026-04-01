#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

CMD_EXE = Path("/mnt/c/Windows/System32/cmd.exe")
COPY_EXCLUDES = (
    "dist",
    "node_modules",
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".DS_Store",
)


def log(message: str) -> None:
    print(f"[package-release] {message}")


def run(command: list[str], *, cwd: Path | None = None) -> None:
    pretty = " ".join(command)
    if cwd:
        log(f"run (cwd={cwd}): {pretty}")
    else:
        log(f"run: {pretty}")
    subprocess.run(command, cwd=str(cwd) if cwd else None, check=True)


def run_checked_output(command: list[str]) -> str:
    return subprocess.check_output(command, text=True).strip()


def is_wsl() -> bool:
    try:
        return "microsoft" in Path("/proc/version").read_text(encoding="utf-8").lower()
    except OSError:
        return False


def require_file(path: Path, description: str) -> None:
    if not path.exists():
        raise SystemExit(f"{description} not found: {path}")


def ensure_windows_command_available(command_name: str) -> None:
    if not CMD_EXE.exists():
        raise SystemExit("Windows cmd.exe not found; cannot use Windows npm/node from WSL.")

    result = subprocess.run(
        [str(CMD_EXE), "/C", f"where {command_name}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        raise SystemExit(
            f'Windows command "{command_name}" is not available in PATH. '
            "Please install Node.js/npm on Windows or run packaging on a system with npm available."
        )


def to_windows_path(path: Path) -> str:
    return run_checked_output(["wslpath", "-w", str(path)])


def run_windows_shell(command: str) -> None:
    run([str(CMD_EXE), "/C", command])


def ensure_windows_path_safe_for_cmd(path: str) -> None:
    if " " in path:
        raise SystemExit(
            "WSL packaging currently requires a Windows path without spaces when invoking npm.cmd. "
            f"Unsupported path: {path}"
        )


def find_native_command(*names: str) -> str | None:
    for name in names:
        resolved = shutil.which(name)
        if resolved:
            return resolved
    return None


def install_runtime_dependencies(stage_dir: Path) -> None:
    install_args = "install --omit=dev --ignore-scripts --no-audit --no-fund"
    if is_wsl():
        ensure_windows_command_available("npm.cmd")
        win_stage_dir = to_windows_path(stage_dir)
        ensure_windows_path_safe_for_cmd(win_stage_dir)
        run_windows_shell(f'npm.cmd --prefix {win_stage_dir} {install_args}')
        return

    npm = find_native_command("npm", "npm.cmd")
    if not npm:
        raise SystemExit("npm was not found in PATH.")
    run([npm, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=stage_dir)


def run_smoke_test(stage_dir: Path) -> None:
    if is_wsl():
        ensure_windows_command_available("npm.cmd")
        win_stage_dir = to_windows_path(stage_dir)
        ensure_windows_path_safe_for_cmd(win_stage_dir)
        run_windows_shell(f'npm.cmd --prefix {win_stage_dir} run smoke')
        return

    node = find_native_command("node", "node.exe")
    if not node:
        raise SystemExit("node was not found in PATH.")
    run([node, "tests/smoke.mjs"], cwd=stage_dir)


def read_package_metadata(plugin_root: Path) -> tuple[str, str]:
    package_json = json.loads((plugin_root / "package.json").read_text(encoding="utf-8"))
    manifest_json = json.loads((plugin_root / "manifest.json").read_text(encoding="utf-8"))
    plugin_name = manifest_json.get("id") or package_json.get("name") or plugin_root.name
    version = manifest_json.get("version") or package_json.get("version") or "0.0.0"
    return plugin_name, version


def copy_plugin_source(plugin_root: Path, stage_dir: Path) -> None:
    ignore = shutil.ignore_patterns(*COPY_EXCLUDES)
    shutil.copytree(plugin_root, stage_dir, ignore=ignore)


def build_zip(stage_dir: Path, zip_path: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file_path in sorted(stage_dir.rglob("*")):
            if file_path.is_dir():
                continue
            archive_path = Path(stage_dir.name) / file_path.relative_to(stage_dir)
            archive.write(file_path, archive_path.as_posix())


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a Hanako-installable release zip that includes runtime dependencies.",
    )
    parser.add_argument(
        "--out-dir",
        default="dist",
        help="Output directory for the generated zip (default: dist)",
    )
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Run tests/smoke.mjs inside the staged release before zipping.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_path = Path(__file__).resolve()
    plugin_root = script_path.parent.parent
    require_file(plugin_root / "package.json", "package.json")
    require_file(plugin_root / "manifest.json", "manifest.json")

    plugin_name, version = read_package_metadata(plugin_root)
    out_dir = (plugin_root / args.out_dir).resolve()
    zip_path = out_dir / f"{plugin_name}-{version}.zip"
    checksum_path = out_dir / f"{plugin_name}-{version}.sha256.txt"

    log(f"plugin root: {plugin_root}")
    log(f"output zip: {zip_path}")

    with tempfile.TemporaryDirectory(prefix=f"{plugin_name}-build-", dir=plugin_root.parent) as temp_dir:
        temp_root = Path(temp_dir)
        stage_dir = temp_root / plugin_name
        log(f"staging copy to: {stage_dir}")
        copy_plugin_source(plugin_root, stage_dir)

        log("installing runtime dependencies into staged copy")
        install_runtime_dependencies(stage_dir)

        if args.smoke:
            log("running smoke test inside staged copy")
            run_smoke_test(stage_dir)

        log("creating release zip")
        build_zip(stage_dir, zip_path)

    checksum = sha256_file(zip_path)
    checksum_path.write_text(f"{checksum}  {zip_path.name}\n", encoding="utf-8")

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    log(f"done: {zip_path}")
    log(f"sha256: {checksum}")
    log(f"size: {size_mb:.2f} MiB")
    log(f"checksum file: {checksum_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
