import * as vscode from 'vscode';
import { DataManager, ProjectData, CommitData } from './dataManager';

export class ReportGenerator {
    constructor(private dataManager: DataManager) {}

    public async generateReport(startDate: Date, endDate: Date): Promise<string> {
        const config = vscode.workspace.getConfiguration('projectReportCompiler');
        const format = config.get('reportFormat', 'markdown') as string;

        const commitsData = await this.dataManager.getCommitsInDateRange(startDate, endDate);
        
        if (commitsData.length === 0) {
            return this.formatNoDataMessage(startDate, endDate, format);
        }

        switch (format) {
            case 'html':
                return this.generateHtmlReport(commitsData, startDate, endDate);
            case 'txt':
                return this.generatePlainTextReport(commitsData, startDate, endDate);
            default:
                return this.generateMarkdownReport(commitsData, startDate, endDate);
        }
    }

    public async generateProjectReport(project: ProjectData): Promise<string> {
        const config = vscode.workspace.getConfiguration('projectReportCompiler');
        const format = config.get('reportFormat', 'markdown') as string;

        switch (format) {
            case 'html':
                return this.generateProjectHtmlReport(project);
            case 'txt':
                return this.generateProjectPlainTextReport(project);
            default:
                return this.generateProjectMarkdownReport(project);
        }
    }

    private generateMarkdownReport(commitsData: { project: string; commits: CommitData[] }[], startDate: Date, endDate: Date): string {
        const report = [];
        
        // Header
        report.push(`# Work Report`);
        report.push(`**Period:** ${this.formatDate(startDate)} to ${this.formatDate(endDate)}`);
        report.push(`**Generated:** ${this.formatDateTime(new Date())}`);
        report.push('');

        // Summary
        const totalCommits = commitsData.reduce((sum, pd) => sum + pd.commits.length, 0);
        const totalProjects = commitsData.length;
        const totalFiles = commitsData.reduce((sum, pd) => 
            sum + pd.commits.reduce((fileSum, commit) => fileSum + commit.files.length, 0), 0);
        const totalAdditions = commitsData.reduce((sum, pd) => 
            sum + pd.commits.reduce((addSum, commit) => 
                addSum + commit.files.reduce((lineSum, file) => lineSum + file.additions, 0), 0), 0);
        const totalDeletions = commitsData.reduce((sum, pd) => 
            sum + pd.commits.reduce((delSum, commit) => 
                delSum + commit.files.reduce((lineSum, file) => lineSum + file.deletions, 0), 0), 0);

        report.push(`## Summary`);
        report.push(`- **Projects worked on:** ${totalProjects}`);
        report.push(`- **Total commits:** ${totalCommits}`);
        report.push(`- **Files modified:** ${totalFiles}`);
        report.push(`- **Lines added:** ${totalAdditions.toLocaleString()}`);
        report.push(`- **Lines deleted:** ${totalDeletions.toLocaleString()}`);
        report.push('');

        // Project details
        report.push(`## Project Details`);
        report.push('');

        for (const projectData of commitsData) {
            report.push(`### ${this.capitalizeProjectName(projectData.project)}`);
            report.push(`**Commits:** ${projectData.commits.length}`);
            report.push('');

            // Group commits by date
            const commitsByDate = this.groupCommitsByDate(projectData.commits);
            
            for (const [date, commits] of Object.entries(commitsByDate)) {
                report.push(`#### ${date}`);
                report.push('');
                
                for (const commit of commits) {
                    report.push(`- **${this.formatTime(new Date(commit.date))}** - ${this.cleanCommitMessage(commit.message)}`);
                    
                    if (commit.files.length > 0) {
                        const filesSummary = this.summarizeFiles(commit.files);
                        report.push(`  - Files: ${filesSummary}`);
                    }
                }
                report.push('');
            }
        }

        // Daily breakdown
        report.push(`## Daily Breakdown`);
        report.push('');

        const dailyActivity = this.getDailyActivity(commitsData, startDate, endDate);
        
        for (const [date, activity] of Object.entries(dailyActivity)) {
            if (activity.commits > 0) {
                report.push(`### ${date}`);
                report.push(`- **Commits:** ${activity.commits}`);
                report.push(`- **Projects:** ${activity.projects.join(', ')}`);
                report.push(`- **Files modified:** ${activity.files}`);
                report.push('');
            }
        }

        // Add signature
        report.push('');
        report.push('---');
        report.push('');
        report.push('*Generated by [Project Report Compiler](https://github.com/blessingmwiti/project-report-compiler)*');

        return report.join('\n');
    }

    private generateProjectMarkdownReport(project: ProjectData): string {
        const report = [];
        
        report.push(`# Project Report: ${this.capitalizeProjectName(project.name)}`);
        report.push(`**Path:** ${project.path}`);
        report.push(`**Total Commits:** ${project.commits.length}`);
        report.push(`**Last Activity:** ${this.formatDateTime(new Date(project.lastActivity))}`);
        report.push(`**Created:** ${this.formatDateTime(new Date(project.createdAt))}`);
        report.push('');

        if (project.commits.length === 0) {
            report.push('No commits found for this project.');
            return report.join('\n');
        }

        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentCommits = project.commits.filter(commit => 
            new Date(commit.date) >= thirtyDaysAgo
        );

        report.push(`## Recent Activity (Last 30 Days)`);
        report.push(`**Recent Commits:** ${recentCommits.length}`);
        report.push('');

        if (recentCommits.length > 0) {
            const commitsByDate = this.groupCommitsByDate(recentCommits);
            
            for (const [date, commits] of Object.entries(commitsByDate)) {
                report.push(`### ${date}`);
                report.push('');
                
                for (const commit of commits) {
                    report.push(`- **${this.formatTime(new Date(commit.date))}** - ${this.cleanCommitMessage(commit.message)}`);
                    if (commit.files.length > 0) {
                        const filesSummary = this.summarizeFiles(commit.files);
                        report.push(`  - Files: ${filesSummary}`);
                    }
                }
                report.push('');
            }
        }

        // All time stats
        const stats = this.calculateProjectStats(project);
        report.push(`## All Time Statistics`);
        report.push(`- **Total files modified:** ${stats.totalFiles}`);
        report.push(`- **Total lines added:** ${stats.totalAdditions.toLocaleString()}`);
        report.push(`- **Total lines deleted:** ${stats.totalDeletions.toLocaleString()}`);
        report.push(`- **First commit:** ${this.formatDateTime(new Date(stats.firstCommit))}`);
        report.push(`- **Last commit:** ${this.formatDateTime(new Date(stats.lastCommit))}`);
        report.push('');

        // Add signature
        report.push('');
        report.push('---');
        report.push('');
        report.push('*Generated by [Project Report Compiler](https://github.com/blessingmwiti/project-report-compiler)*');

        return report.join('\n');
    }

    private generateHtmlReport(commitsData: { project: string; commits: CommitData[] }[], startDate: Date, endDate: Date): string {
        const markdownReport = this.generateMarkdownReport(commitsData, startDate, endDate);
        
        // Convert markdown to HTML with proper styling
        let htmlReport = markdownReport
            .replace(/^# (.*$)/gim, '<h1 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 style="color: #374151; margin-top: 24px; margin-bottom: 12px;">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 style="color: #4b5563; margin-top: 20px; margin-bottom: 8px;">$1</h3>')
            .replace(/^#### (.*$)/gim, '<h4 style="color: #6b7280; margin-top: 16px; margin-bottom: 6px;">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1f2937;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: none;">$1</a>')
            .replace(/^- (.*$)/gim, '<li style="margin-bottom: 4px;">$1</li>')
            .replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">')
            .replace(/\n\n/g, '</p><p style="margin-bottom: 12px; line-height: 1.6;">')
            .replace(/^/, '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;"><p style="margin-bottom: 12px; line-height: 1.6;">')
            .replace(/$/, '</p></div>');

        // Wrap lists properly
        htmlReport = htmlReport.replace(/(<li[^>]*>.*?<\/li>)/gs, '<ul style="margin-bottom: 12px; padding-left: 20px;">$1</ul>');
        
        return htmlReport;
    }

    private generatePlainTextReport(commitsData: { project: string; commits: CommitData[] }[], startDate: Date, endDate: Date): string {
        const report = [];
        
        // Header with decorative border
        const title = 'WORK REPORT';
        const border = '═'.repeat(60);
        const titlePadding = ' '.repeat(Math.max(0, (60 - title.length) / 2));
        
        report.push(border);
        report.push(`${titlePadding}${title}`);
        report.push(border);
        report.push('');
        report.push(`📅 PERIOD: ${this.formatDate(startDate)} to ${this.formatDate(endDate)}`);
        report.push(`🕒 GENERATED: ${this.formatDateTime(new Date())}`);
        report.push('');

        if (commitsData.length === 0) {
            report.push('❌ No commits found for this period.');
            report.push('');
            report.push('─'.repeat(60));
            report.push('Generated by Project Report Compiler');
            report.push('https://github.com/blessingmwiti/project-report-compiler');
            return report.join('\n');
        }

        // Summary section
        const totalCommits = commitsData.reduce((sum, pd) => sum + pd.commits.length, 0);
        const totalProjects = commitsData.length;
        const totalFiles = commitsData.reduce((sum, pd) => 
            sum + pd.commits.reduce((fileSum, commit) => fileSum + commit.files.length, 0), 0);
        const totalAdditions = commitsData.reduce((sum, pd) => 
            sum + pd.commits.reduce((addSum, commit) => 
                addSum + commit.files.reduce((lineSum, file) => lineSum + file.additions, 0), 0), 0);
        const totalDeletions = commitsData.reduce((sum, pd) => 
            sum + pd.commits.reduce((delSum, commit) => 
                delSum + commit.files.reduce((lineSum, file) => lineSum + file.deletions, 0), 0), 0);

        report.push('📊 SUMMARY');
        report.push('─'.repeat(20));
        report.push(`• Projects worked on: ${totalProjects}`);
        report.push(`• Total commits: ${totalCommits}`);
        report.push(`• Files modified: ${totalFiles}`);
        report.push(`• Lines added: ${totalAdditions.toLocaleString()}`);
        report.push(`• Lines deleted: ${totalDeletions.toLocaleString()}`);
        report.push('');

        // Project details
        report.push('📁 PROJECT DETAILS');
        report.push('─'.repeat(30));
        report.push('');

        for (const projectData of commitsData) {
            const projectTitle = this.capitalizeProjectName(projectData.project).toUpperCase();
            report.push(`🔶 ${projectTitle}`);
            report.push(`   Commits: ${projectData.commits.length}`);
            report.push('');

            // Group commits by date
            const commitsByDate = this.groupCommitsByDate(projectData.commits);
            
            for (const [date, commits] of Object.entries(commitsByDate)) {
                report.push(`   📅 ${date}`);
                report.push('   ' + '·'.repeat(date.length + 4));
                
                for (const commit of commits) {
                    const time = this.formatTime(new Date(commit.date));
                    const message = this.cleanCommitMessage(commit.message);
                    report.push(`   • ${time} - ${message}`);
                    
                    if (commit.files.length > 0) {
                        const filesSummary = this.summarizeFiles(commit.files);
                        report.push(`     📄 Files: ${filesSummary}`);
                    }
                }
                report.push('');
            }
        }

        // Daily breakdown
        report.push('📅 DAILY BREAKDOWN');
        report.push('─'.repeat(25));
        report.push('');

        const dailyActivity = this.getDailyActivity(commitsData, startDate, endDate);
        
        for (const [date, activity] of Object.entries(dailyActivity)) {
            if (activity.commits > 0) {
                report.push(`🗓️  ${date}`);
                report.push(`   • Commits: ${activity.commits}`);
                report.push(`   • Projects: ${activity.projects.join(', ')}`);
                report.push(`   • Files modified: ${activity.files}`);
                report.push('');
            }
        }

        // Signature
        report.push('─'.repeat(60));
        report.push('');
        report.push('🔗 Generated by Project Report Compiler');
        report.push('   https://github.com/blessingmwiti/project-report-compiler');

        return report.join('\n');
    }

    private generateProjectHtmlReport(project: ProjectData): string {
        const markdownReport = this.generateProjectMarkdownReport(project);
        return this.generateHtmlReport([{ project: project.name, commits: project.commits }], new Date(0), new Date());
    }

    private generateProjectPlainTextReport(project: ProjectData): string {
        const report = [];
        
        // Header with decorative border
        const title = `PROJECT REPORT: ${this.capitalizeProjectName(project.name).toUpperCase()}`;
        const border = '═'.repeat(Math.max(60, title.length + 4));
        const titlePadding = ' '.repeat(Math.max(0, (border.length - title.length) / 2));
        
        report.push(border);
        report.push(`${titlePadding}${title}`);
        report.push(border);
        report.push('');
        report.push(`📁 Path: ${project.path}`);
        report.push(`📊 Total Commits: ${project.commits.length}`);
        report.push(`🕒 Last Activity: ${this.formatDateTime(new Date(project.lastActivity))}`);
        report.push(`📅 Created: ${this.formatDateTime(new Date(project.createdAt))}`);
        report.push('');

        if (project.commits.length === 0) {
            report.push('❌ No commits found for this project.');
            report.push('');
            report.push('─'.repeat(60));
            report.push('🔗 Generated by Project Report Compiler');
            report.push('   https://github.com/blessingmwiti/project-report-compiler');
            return report.join('\n');
        }

        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentCommits = project.commits.filter(commit => 
            new Date(commit.date) >= thirtyDaysAgo
        );

        report.push('🕒 RECENT ACTIVITY (Last 30 Days)');
        report.push('─'.repeat(40));
        report.push(`Recent Commits: ${recentCommits.length}`);
        report.push('');

        if (recentCommits.length > 0) {
            const commitsByDate = this.groupCommitsByDate(recentCommits);
            
            for (const [date, commits] of Object.entries(commitsByDate)) {
                report.push(`📅 ${date}`);
                report.push('   ' + '·'.repeat(date.length + 4));
                
                for (const commit of commits) {
                    const time = this.formatTime(new Date(commit.date));
                    const message = this.cleanCommitMessage(commit.message);
                    report.push(`   • ${time} - ${message}`);
                    if (commit.files.length > 0) {
                        const filesSummary = this.summarizeFiles(commit.files);
                        report.push(`     📄 Files: ${filesSummary}`);
                    }
                }
                report.push('');
            }
        }

        // All time stats
        const stats = this.calculateProjectStats(project);
        report.push('📈 ALL TIME STATISTICS');
        report.push('─'.repeat(30));
        report.push(`• Total files modified: ${stats.totalFiles}`);
        report.push(`• Total lines added: ${stats.totalAdditions.toLocaleString()}`);
        report.push(`• Total lines deleted: ${stats.totalDeletions.toLocaleString()}`);
        report.push(`• First commit: ${this.formatDateTime(new Date(stats.firstCommit))}`);
        report.push(`• Last commit: ${this.formatDateTime(new Date(stats.lastCommit))}`);
        report.push('');

        // Signature
        report.push('─'.repeat(60));
        report.push('');
        report.push('🔗 Generated by Project Report Compiler');
        report.push('   https://github.com/blessingmwiti/project-report-compiler');

        return report.join('\n');
    }

    private formatNoDataMessage(startDate: Date, endDate: Date, format: string): string {
        const message = `No commits found between ${this.formatDate(startDate)} and ${this.formatDate(endDate)}.`;
        
        switch (format) {
            case 'html':
                return `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Work Report</h1>
                    <p style="margin-bottom: 12px; line-height: 1.6;">${message}</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <p style="margin-bottom: 12px; line-height: 1.6;">
                        <em>Generated by <a href="https://github.com/blessingmwiti/project-report-compiler" style="color: #2563eb; text-decoration: none;">Project Report Compiler</a></em>
                    </p>
                </div>`;
            case 'txt':
                return `WORK REPORT\n${'═'.repeat(60)}\n\n❌ ${message}\n\n${'─'.repeat(60)}\n🔗 Generated by Project Report Compiler\n   https://github.com/blessingmwiti/project-report-compiler`;
            default:
                return `# Work Report\n\n${message}\n\n---\n\n*Generated by [Project Report Compiler](https://github.com/blessingmwiti/project-report-compiler)*`;
        }
    }

    private groupCommitsByDate(commits: CommitData[]): { [date: string]: CommitData[] } {
        const groups: { [date: string]: CommitData[] } = {};
        
        for (const commit of commits) {
            const date = this.formatDate(new Date(commit.date));
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(commit);
        }
        
        // Sort dates descending
        const sortedGroups: { [date: string]: CommitData[] } = {};
        const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        for (const date of sortedDates) {
            // Sort commits within each date by time descending
            groups[date].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            sortedGroups[date] = groups[date];
        }
        
        return sortedGroups;
    }

    private getDailyActivity(commitsData: { project: string; commits: CommitData[] }[], startDate: Date, endDate: Date): { [date: string]: { commits: number; projects: string[]; files: number } } {
        const activity: { [date: string]: { commits: number; projects: string[]; files: number } } = {};
        
        // Initialize all dates in range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = this.formatDate(currentDate);
            activity[dateStr] = { commits: 0, projects: [], files: 0 };
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Populate with actual data
        for (const projectData of commitsData) {
            for (const commit of projectData.commits) {
                const dateStr = this.formatDate(new Date(commit.date));
                if (activity[dateStr]) {
                    activity[dateStr].commits++;
                    activity[dateStr].files += commit.files.length;
                    if (!activity[dateStr].projects.includes(this.capitalizeProjectName(projectData.project))) {
                        activity[dateStr].projects.push(this.capitalizeProjectName(projectData.project));
                    }
                }
            }
        }
        
        return activity;
    }

    private calculateProjectStats(project: ProjectData): {
        totalFiles: number;
        totalAdditions: number;
        totalDeletions: number;
        firstCommit: string;
        lastCommit: string;
    } {
        let totalFiles = 0;
        let totalAdditions = 0;
        let totalDeletions = 0;
        let firstCommit = project.commits[0]?.date || new Date().toISOString();
        let lastCommit = project.commits[0]?.date || new Date().toISOString();

        for (const commit of project.commits) {
            totalFiles += commit.files.length;
            
            for (const file of commit.files) {
                totalAdditions += file.additions;
                totalDeletions += file.deletions;
            }

            const commitDate = new Date(commit.date);
            if (commitDate < new Date(firstCommit)) {
                firstCommit = commit.date;
            }
            if (commitDate > new Date(lastCommit)) {
                lastCommit = commit.date;
            }
        }

        return {
            totalFiles,
            totalAdditions,
            totalDeletions,
            firstCommit,
            lastCommit
        };
    }

    private summarizeFiles(files: { filename: string; additions: number; deletions: number }[]): string {
        if (files.length === 0) {
            return 'No files';
        }

        if (files.length === 1) {
            const file = files[0];
            return `${file.filename} (+${file.additions}/-${file.deletions})`;
        }

        const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
        const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
        
        return `${files.length} files (+${totalAdditions}/-${totalDeletions})`;
    }

    private cleanCommitMessage(message: string): string {
        // Clean up commit message for display
        return message
            .split('\n')[0] // Take only the first line
            .trim()
            .replace(/^(feat|fix|docs|style|refactor|test|chore)(\(.+?\))?:\s*/i, '') // Remove conventional commit prefixes
            .replace(/^\w+:\s*/, ''); // Remove other prefixes like "update: "
    }

    private capitalizeProjectName(name: string): string {
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    private formatDateTime(date: Date): string {
        return date.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    private formatTime(date: Date): string {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
