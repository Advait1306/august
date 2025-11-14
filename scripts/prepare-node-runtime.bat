@echo off
REM Prepares portable Node.js runtime for Windows builds
REM Usage: prepare-node-runtime.bat [version]

setlocal

set NODE_VERSION=%1
if "%NODE_VERSION%"=="" set NODE_VERSION=v20.11.0

set SCRIPT_DIR=%~dp0
set RESOURCES_DIR=%SCRIPT_DIR%..\resources
set NODE_DIR=%RESOURCES_DIR%\node

echo Preparing Node.js %NODE_VERSION% for bundling...

REM Detect architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set ARCH=x64
) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set ARCH=arm64
) else (
    echo Unsupported architecture
    exit /b 1
)

set FILENAME=node-%NODE_VERSION%-win-%ARCH%.zip
set URL=https://nodejs.org/dist/%NODE_VERSION%/%FILENAME%

REM Create directories
if not exist "%RESOURCES_DIR%" mkdir "%RESOURCES_DIR%"
cd /d "%RESOURCES_DIR%"

REM Download if not exists
if not exist "%FILENAME%" (
    echo Downloading from %URL%...
    curl -L -o "%FILENAME%" "%URL%"
    if errorlevel 1 (
        echo Download failed
        exit /b 1
    )
) else (
    echo Archive already exists, skipping download
)

REM Extract using PowerShell
echo Extracting...
if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
mkdir "%NODE_DIR%"

powershell -Command "Expand-Archive -Path '%FILENAME%' -DestinationPath '.' -Force"
xcopy /E /I /Y "node-%NODE_VERSION%-win-%ARCH%\*" "%NODE_DIR%"
rmdir /s /q "node-%NODE_VERSION%-win-%ARCH%"

REM Clean up archive
del "%FILENAME%"

REM Verify
if exist "%NODE_DIR%\node.exe" (
    echo ✓ Node.js runtime successfully prepared at: %NODE_DIR%
    "%NODE_DIR%\node.exe" --version
) else (
    echo ✗ Error: Node.js binary not found
    exit /b 1
)

endlocal
