import * as vscode from 'vscode';
import { ProjectTracker } from './projectTracker';
import { ReportGenerator } from './reportGenerator';
import { DataManager } from './dataManager';

let projectTracker: ProjectTracker;
let reportGenerator: ReportGenerator;
let dataManager: DataManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Report Compiler is now active!');

    // Initialize core components
    dataManager = new DataManager(context);
    projectTracker = new ProjectTracker(dataManager);
    reportGenerator = new ReportGenerator(dataManager);

    // Register commands
    const generateReportCommand = vscode.commands.registerCommand('projectReportCompiler.generateReport', async () => {
        await generateReport();
    });

    const viewTrackedProjectsCommand = vscode.commands.registerCommand('projectReportCompiler.viewTrackedProjects', async () => {
        await viewTrackedProjects();
    });

    const exportReportCommand = vscode.commands.registerCommand('projectReportCompiler.exportReport', async () => {
        await exportReport();
    });

    const openSettingsCommand = vscode.commands.registerCommand('projectReportCompiler.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'projectReportCompiler');
    });

    // Add commands to subscription
    context.subscriptions.push(
        generateReportCommand,
        viewTrackedProjectsCommand,
        exportReportCommand,
        openSettingsCommand
    );

    // Start automatic tracking if enabled
    const config = vscode.workspace.getConfiguration('projectReportCompiler');
    if (config.get('autoTrack', true)) {
        projectTracker.startTracking();
    }

    // Track current workspace on activation
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        projectTracker.trackCurrentWorkspace();
    }

    // Listen for workspace changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectTracker.trackCurrentWorkspace();
        }
    });

    vscode.window.showInformationMessage('Project Report Compiler is ready to track your work!');
}

async function generateReport(): Promise<void> {
    try {
        const reportType = await vscode.window.showQuickPick(
            ['This Week', 'Last Week', 'This Month', 'Last Month', 'Custom Range'],
            { placeHolder: 'Select report period' }
        );

        if (!reportType) {
            return;
        }

        let startDate: Date;
        let endDate: Date = new Date();

        switch (reportType) {
            case 'This Week':
                startDate = getStartOfWeek(new Date());
                break;
            case 'Last Week':
                const lastWeekEnd = new Date();
                lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
                endDate = getEndOfWeek(lastWeekEnd);
                startDate = getStartOfWeek(lastWeekEnd);
                break;
            case 'This Month':
                startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                break;
            case 'Last Month':
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
                endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
                break;
            case 'Custom Range':
                const range = await getCustomDateRange();
                if (!range) {
                    return;
                }
                startDate = range.start;
                endDate = range.end;
                break;
            default:
                return;
        }

        const report = await reportGenerator.generateReport(startDate, endDate);
        await showReport(report, reportType);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
    }
}

async function viewTrackedProjects(): Promise<void> {
    try {
        const projects = await dataManager.getAllProjects();
        
        if (projects.length === 0) {
            vscode.window.showInformationMessage('No projects tracked yet. Start working on a git repository to begin tracking!');
            return;
        }

        const projectItems = projects.map(project => ({
            label: project.name,
            description: `${project.commits.length} commits`,
            detail: `Last activity: ${project.lastActivity ? new Date(project.lastActivity).toLocaleDateString() : 'Unknown'}`,
            project: project
        }));

        const selected = await vscode.window.showQuickPick(projectItems, {
            placeHolder: 'Select a project to view details'
        });

        if (selected) {
            const report = await reportGenerator.generateProjectReport(selected.project);
            await showReport(report, `Project: ${selected.project.name}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to view tracked projects: ${error}`);
    }
}

async function exportReport(): Promise<void> {
    try {
        const exportType = await vscode.window.showQuickPick(
            ['Copy to Clipboard', 'Save as File', 'Open in New Tab'],
            { placeHolder: 'How would you like to export the report?' }
        );

        if (!exportType) {
            return;
        }

        // First generate the report
        const reportType = await vscode.window.showQuickPick(
            ['This Week', 'Last Week', 'This Month', 'Last Month'],
            { placeHolder: 'Select report period to export' }
        );

        if (!reportType) {
            return;
        }

        let startDate: Date;
        let endDate: Date = new Date();

        switch (reportType) {
            case 'This Week':
                startDate = getStartOfWeek(new Date());
                break;
            case 'Last Week':
                const lastWeekEnd = new Date();
                lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
                endDate = getEndOfWeek(lastWeekEnd);
                startDate = getStartOfWeek(lastWeekEnd);
                break;
            case 'This Month':
                startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                break;
            case 'Last Month':
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
                endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
                break;
            default:
                return;
        }

        const report = await reportGenerator.generateReport(startDate, endDate);

        switch (exportType) {
            case 'Copy to Clipboard':
                await vscode.env.clipboard.writeText(report);
                vscode.window.showInformationMessage('Report copied to clipboard!');
                break;
            case 'Save as File':
                await saveReportAsFile(report, reportType);
                break;
            case 'Open in New Tab':
                const doc = await vscode.workspace.openTextDocument({
                    content: report,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
                break;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to export report: ${error}`);
    }
}

async function showReport(report: string, title: string): Promise<void> {
    const action = await vscode.window.showInformationMessage(
        `${title} report generated!`,
        'View Report',
        'Copy to Clipboard',
        'Save as File'
    );

    switch (action) {
        case 'View Report':
            const doc = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
            break;
        case 'Copy to Clipboard':
            await vscode.env.clipboard.writeText(report);
            vscode.window.showInformationMessage('Report copied to clipboard!');
            break;
        case 'Save as File':
            await saveReportAsFile(report, title);
            break;
    }
}

async function saveReportAsFile(report: string, title: string): Promise<void> {
    const defaultName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.md`;
    
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultName),
        filters: {
            'Markdown': ['md'],
            'Text': ['txt'],
            'All Files': ['*']
        }
    });

    if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(report, 'utf8'));
        vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
    }
}

async function getCustomDateRange(): Promise<{ start: Date; end: Date } | undefined> {
    const startDateStr = await vscode.window.showInputBox({
        prompt: 'Enter start date (YYYY-MM-DD)',
        placeHolder: '2025-01-01'
    });

    if (!startDateStr) {
        return undefined;
    }

    const endDateStr = await vscode.window.showInputBox({
        prompt: 'Enter end date (YYYY-MM-DD)',
        placeHolder: '2025-01-31'
    });

    if (!endDateStr) {
        return undefined;
    }

    try {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error('Invalid date format');
        }

        if (start > end) {
            throw new Error('Start date must be before end date');
        }

        return { start, end };
    } catch (error) {
        vscode.window.showErrorMessage(`Invalid date range: ${error}`);
        return undefined;
    }
}

function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

function getEndOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

export function deactivate() {
    if (projectTracker) {
        projectTracker.stopTracking();
    }
}
