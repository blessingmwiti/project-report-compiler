import * as vscode from 'vscode';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { DataManager, ProjectData, CommitData } from './dataManager';

export class ProjectTracker {
    private trackingInterval: NodeJS.Timeout | undefined;
    private trackedProjects: Map<string, SimpleGit> = new Map();

    constructor(private dataManager: DataManager) {}

    public startTracking(): void {
        const config = vscode.workspace.getConfiguration('projectReportCompiler');
        const interval = config.get('trackInterval', 300000); // Default 5 minutes

        this.trackingInterval = setInterval(() => {
            this.checkForNewCommits();
        }, interval);

        console.log('Project tracking started');
    }

    public stopTracking(): void {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = undefined;
        }
        console.log('Project tracking stopped');
    }

    public async trackCurrentWorkspace(): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        for (const folder of vscode.workspace.workspaceFolders) {
            await this.addProjectToTracking(folder.uri.fsPath);
        }
    }

    private async addProjectToTracking(projectPath: string): Promise<void> {
        try {
            const git = simpleGit(projectPath);
            
            // Check if it's a git repository
            const isRepo = await git.checkIsRepo();
            if (!isRepo) {
                console.log(`${projectPath} is not a git repository, skipping`);
                return;
            }

            // Get project name from directory
            const projectName = this.extractProjectName(projectPath);
            
            // Store git instance for this project
            this.trackedProjects.set(projectPath, git);

            // Get existing project data or create new
            let projectData = await this.dataManager.getProject(projectName);
            if (!projectData) {
                projectData = {
                    name: projectName,
                    path: projectPath,
                    commits: [],
                    lastActivity: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                };
            } else {
                projectData.path = projectPath; // Update path in case it changed
                projectData.lastActivity = new Date().toISOString();
            }

            // Get recent commits
            await this.fetchRecentCommits(projectData, git);
            
            // Save project data
            await this.dataManager.saveProject(projectData);

            console.log(`Added project to tracking: ${projectName}`);
        } catch (error) {
            console.error(`Failed to add project to tracking: ${error}`);
        }
    }

    private async checkForNewCommits(): Promise<void> {
        for (const [projectPath, git] of this.trackedProjects.entries()) {
            try {
                const projectName = this.extractProjectName(projectPath);
                const projectData = await this.dataManager.getProject(projectName);
                
                if (projectData) {
                    const hasNewCommits = await this.fetchRecentCommits(projectData, git);
                    if (hasNewCommits) {
                        projectData.lastActivity = new Date().toISOString();
                        await this.dataManager.saveProject(projectData);
                        
                        vscode.window.showInformationMessage(
                            `New commits detected in ${projectName}`,
                            'View Report'
                        ).then(selection => {
                            if (selection === 'View Report') {
                                vscode.commands.executeCommand('projectReportCompiler.generateReport');
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`Failed to check for new commits in ${projectPath}: ${error}`);
            }
        }
    }

    private async fetchRecentCommits(projectData: ProjectData, git: SimpleGit): Promise<boolean> {
        try {
            // Get the last commit hash we have stored
            const lastStoredCommit = projectData.commits.length > 0 
                ? projectData.commits[0].hash 
                : null;

            // Get recent commits (last 50 to be safe)
            const log = await git.log({ maxCount: 50 });
            const commits = log.all;

            let newCommitsCount = 0;
            const newCommits: CommitData[] = [];

            for (const commit of commits) {
                // Stop if we reach a commit we already have
                if (lastStoredCommit && commit.hash === lastStoredCommit) {
                    break;
                }

                // Skip merge commits if they don't have meaningful messages
                if (commit.message.toLowerCase().startsWith('merge ') && 
                    commit.message.toLowerCase().includes('pull request')) {
                    continue;
                }

                const commitData: CommitData = {
                    hash: commit.hash,
                    message: commit.message,
                    author: commit.author_name,
                    email: commit.author_email,
                    date: commit.date,
                    files: [], // We'll populate this if needed
                };

                // Get file changes for this commit
                try {
                    const diffSummary = await git.diffSummary([commit.hash + '~1', commit.hash]);
                    commitData.files = diffSummary.files.map(file => ({
                        filename: file.file,
                        additions: ('insertions' in file) ? file.insertions : 0,
                        deletions: ('deletions' in file) ? file.deletions : 0,
                        changes: ('changes' in file) ? file.changes : 0
                    }));
                } catch (diffError) {
                    // For the first commit, there's no parent to diff against
                    console.log(`Could not get diff for commit ${commit.hash}: ${diffError}`);
                }

                newCommits.push(commitData);
                newCommitsCount++;
            }

            if (newCommitsCount > 0) {
                // Add new commits to the beginning of the array (most recent first)
                projectData.commits = [...newCommits, ...projectData.commits];
                
                // Keep only the last 1000 commits to prevent unlimited growth
                if (projectData.commits.length > 1000) {
                    projectData.commits = projectData.commits.slice(0, 1000);
                }

                console.log(`Found ${newCommitsCount} new commits in ${projectData.name}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`Failed to fetch commits: ${error}`);
            return false;
        }
    }

    private extractProjectName(projectPath: string): string {
        // Get the directory name as the project name
        const dirName = path.basename(projectPath);
        
        // Clean up the name (remove special characters, etc.)
        return dirName
            .replace(/[^a-zA-Z0-9\-_\s]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .toLowerCase();
    }

    public async getProjectCommits(projectName: string, since?: Date, until?: Date): Promise<CommitData[]> {
        const projectData = await this.dataManager.getProject(projectName);
        if (!projectData) {
            return [];
        }

        let commits = projectData.commits;

        // Filter by date range if provided
        if (since || until) {
            commits = commits.filter(commit => {
                const commitDate = new Date(commit.date);
                if (since && commitDate < since) {
                    return false;
                }
                if (until && commitDate > until) {
                    return false;
                }
                return true;
            });
        }

        return commits;
    }

    public async getAllTrackedProjects(): Promise<string[]> {
        const projects = await this.dataManager.getAllProjects();
        return projects.map(p => p.name);
    }

    public async refreshProject(projectName: string): Promise<void> {
        const projectData = await this.dataManager.getProject(projectName);
        if (!projectData || !projectData.path) {
            throw new Error(`Project ${projectName} not found or has no path`);
        }

        const git = simpleGit(projectData.path);
        const isRepo = await git.checkIsRepo();
        
        if (!isRepo) {
            throw new Error(`${projectData.path} is not a git repository`);
        }

        // Clear existing commits and fetch all commits fresh
        projectData.commits = [];
        await this.fetchRecentCommits(projectData, git);
        projectData.lastActivity = new Date().toISOString();
        
        await this.dataManager.saveProject(projectData);
    }
}
