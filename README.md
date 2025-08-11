# Project Report Compiler

A VS Code/Cursor extension that automatically tracks your project work by monitoring git commits and generates beautiful weekly/monthly reports for your job reporting needs.

## Features

- **Automatic Git Commit Tracking**: Monitors all your git repositories for new commits
- **Project Detection**: Automatically detects project names from working directories
- **Human-Readable Reports**: Generates formatted reports showing what you worked on and when
- **Multiple Export Formats**: Export reports as Markdown, HTML, or plain text
- **Flexible Time Ranges**: Generate reports for this week, last week, this month, or custom date ranges
- **Local Data Storage**: All your data stays on your machine in a local JSON file
- **Easy Export**: Copy to clipboard, save as file, or view in VS Code

## How It Works

1. **Install the extension** in VS Code or Cursor
2. **Open any git repository** - the extension automatically starts tracking
3. **Make commits** as you normally would
4. **Generate reports** using the command palette or status bar
5. **Export your reports** for weekly job reporting

## Usage

### Commands

Access these commands through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Project Report: Generate Work Report` - Create a report for a specific time period
- `Project Report: View Tracked Projects` - See all projects being tracked
- `Project Report: Export Report` - Export a report to clipboard or file
- `Project Report: Open Settings` - Configure extension settings

### Automatic Tracking

The extension automatically:
- Detects when you open git repositories
- Tracks new commits every 5 minutes (configurable)
- Stores commit messages, file changes, and timestamps
- Shows notifications when new commits are detected

### Report Generation

Generate reports for:
- **This Week**: Monday to Sunday of current week
- **Last Week**: Previous week's Monday to Sunday
- **This Month**: 1st to last day of current month
- **Last Month**: Previous month's date range
- **Custom Range**: Specify your own start and end dates

## Configuration

Customize the extension behavior in VS Code settings:

```json
{
  "projectReportCompiler.autoTrack": true,
  "projectReportCompiler.trackInterval": 300000,
  "projectReportCompiler.excludePatterns": ["node_modules", ".git", "dist", "build"],
  "projectReportCompiler.reportFormat": "markdown"
}
```

### Settings

- `autoTrack`: Enable/disable automatic commit tracking (default: true)
- `trackInterval`: How often to check for new commits in milliseconds (default: 5 minutes)
- `excludePatterns`: Directory patterns to exclude from tracking
- `reportFormat`: Default format for reports (markdown, html, or plain)

## Installation

### From Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to open a new VS Code window with the extension loaded

### Building VSIX Package

```bash
npm install -g vsce
npx vsce package --no-yarn
```

This creates a `.vsix` file that you can install manually in VS Code.

Or download the release .vsix file and use this command for vscode
```bash
code --install-extension release_file.vsix
```
or cursor
```bash
cursor --install-extension release_file.vsix
```

## Example Report

```markdown
# Work Report
**Period:** Monday, January 15, 2025 to Friday, January 19, 2025
**Generated:** Fri, Jan 19, 2025, 5:30 PM

## Summary
- **Projects worked on:** 2
- **Total commits:** 12
- **Files modified:** 34
- **Lines added:** 1,245
- **Lines deleted:** 567

## Project Details

### E Commerce App
**Commits:** 8

#### Monday, January 15, 2025
- **2:30 PM** - Add user authentication middleware
  - Files: 3 files (+89/-12)
- **4:15 PM** - Implement product search functionality
  - Files: 5 files (+156/-23)

### Project Report Compiler
**Commits:** 4

#### Tuesday, January 16, 2025
- **10:00 AM** - Initial extension setup and structure
  - Files: 6 files (+234/-0)
```

## Privacy & Data

- All data is stored locally on your machine
- No data is sent to external servers
- Data is stored in VS Code's global storage directory
- You have full control over your data and can export/import it anytime

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

If you encounter any issues or have feature requests, please open an issue on GitHub.