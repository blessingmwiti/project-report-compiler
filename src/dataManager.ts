import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface CommitData {
    hash: string;
    message: string;
    author: string;
    email: string;
    date: string;
    files: FileChange[];
}

export interface FileChange {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
}

export interface ProjectData {
    name: string;
    path: string;
    commits: CommitData[];
    lastActivity: string;
    createdAt: string;
}

export interface StorageData {
    projects: ProjectData[];
    version: string;
    lastUpdated: string;
}

export class DataManager {
    private storagePath: string;
    private data: StorageData = {
        projects: [],
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
    };

    constructor(private context: vscode.ExtensionContext) {
        // Use VS Code's global storage path
        this.storagePath = path.join(context.globalStorageUri.fsPath, 'project-data.json');
        this.ensureStorageDirectory();
        this.loadData();
    }

    private ensureStorageDirectory(): void {
        const storageDir = path.dirname(this.storagePath);
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
    }

    private loadData(): void {
        try {
            if (fs.existsSync(this.storagePath)) {
                const fileContent = fs.readFileSync(this.storagePath, 'utf8');
                this.data = JSON.parse(fileContent);
                
                // Migrate data if needed
                this.migrateDataIfNeeded();
            } else {
                this.data = {
                    projects: [],
                    version: '1.0.0',
                    lastUpdated: new Date().toISOString()
                };
                this.saveData();
            }
        } catch (error) {
            console.error('Failed to load data, creating new storage:', error);
            this.data = {
                projects: [],
                version: '1.0.0',
                lastUpdated: new Date().toISOString()
            };
            this.saveData();
        }
    }

    private migrateDataIfNeeded(): void {
        // Future migration logic can go here
        // For now, just ensure all required fields exist
        if (!this.data.version) {
            this.data.version = '1.0.0';
        }
        if (!this.data.lastUpdated) {
            this.data.lastUpdated = new Date().toISOString();
        }
        if (!this.data.projects) {
            this.data.projects = [];
        }

        // Ensure all projects have required fields
        this.data.projects.forEach(project => {
            if (!project.createdAt) {
                project.createdAt = project.lastActivity || new Date().toISOString();
            }
            if (!project.commits) {
                project.commits = [];
            }
            // Ensure all commits have files array
            project.commits.forEach(commit => {
                if (!commit.files) {
                    commit.files = [];
                }
            });
        });
    }

    private saveData(): void {
        try {
            this.data.lastUpdated = new Date().toISOString();
            const jsonData = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.storagePath, jsonData, 'utf8');
        } catch (error) {
            console.error('Failed to save data:', error);
            vscode.window.showErrorMessage('Failed to save project data');
        }
    }

    public async getProject(name: string): Promise<ProjectData | undefined> {
        return this.data.projects.find(project => project.name === name);
    }

    public async getAllProjects(): Promise<ProjectData[]> {
        return [...this.data.projects];
    }

    public async saveProject(projectData: ProjectData): Promise<void> {
        const existingIndex = this.data.projects.findIndex(p => p.name === projectData.name);
        
        if (existingIndex >= 0) {
            this.data.projects[existingIndex] = projectData;
        } else {
            this.data.projects.push(projectData);
        }

        this.saveData();
    }

    public async deleteProject(name: string): Promise<boolean> {
        const initialLength = this.data.projects.length;
        this.data.projects = this.data.projects.filter(p => p.name !== name);
        
        if (this.data.projects.length < initialLength) {
            this.saveData();
            return true;
        }
        return false;
    }

    public async getCommitsInDateRange(startDate: Date, endDate: Date): Promise<{ project: string; commits: CommitData[] }[]> {
        const result: { project: string; commits: CommitData[] }[] = [];

        for (const project of this.data.projects) {
            const commitsInRange = project.commits.filter(commit => {
                const commitDate = new Date(commit.date);
                return commitDate >= startDate && commitDate <= endDate;
            });

            if (commitsInRange.length > 0) {
                result.push({
                    project: project.name,
                    commits: commitsInRange
                });
            }
        }

        return result;
    }

    public async getProjectStats(projectName?: string): Promise<{
        totalCommits: number;
        totalProjects: number;
        filesChanged: number;
        linesAdded: number;
        linesDeleted: number;
        firstCommit?: string;
        lastCommit?: string;
    }> {
        let projects = this.data.projects;
        
        if (projectName) {
            const project = await this.getProject(projectName);
            projects = project ? [project] : [];
        }

        let totalCommits = 0;
        let filesChanged = 0;
        let linesAdded = 0;
        let linesDeleted = 0;
        let firstCommit: string | undefined;
        let lastCommit: string | undefined;

        for (const project of projects) {
            totalCommits += project.commits.length;
            
            for (const commit of project.commits) {
                const commitDate = new Date(commit.date);
                
                if (!firstCommit || commitDate < new Date(firstCommit)) {
                    firstCommit = commit.date;
                }
                if (!lastCommit || commitDate > new Date(lastCommit)) {
                    lastCommit = commit.date;
                }

                for (const file of commit.files) {
                    filesChanged++;
                    linesAdded += file.additions;
                    linesDeleted += file.deletions;
                }
            }
        }

        return {
            totalCommits,
            totalProjects: projects.length,
            filesChanged,
            linesAdded,
            linesDeleted,
            firstCommit,
            lastCommit
        };
    }

    public async exportData(): Promise<StorageData> {
        return { ...this.data };
    }

    public async importData(data: StorageData): Promise<void> {
        // Validate the imported data
        if (!data.projects || !Array.isArray(data.projects)) {
            throw new Error('Invalid data format');
        }

        // Backup current data
        const backupPath = this.storagePath + '.backup.' + Date.now();
        try {
            fs.copyFileSync(this.storagePath, backupPath);
        } catch (error) {
            console.warn('Failed to create backup:', error);
        }

        // Import new data
        this.data = data;
        this.migrateDataIfNeeded();
        this.saveData();

        vscode.window.showInformationMessage(`Data imported successfully. Backup saved to ${backupPath}`);
    }

    public async clearAllData(): Promise<void> {
        const confirmation = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all tracked project data? This cannot be undone.',
            { modal: true },
            'Yes, Clear All Data'
        );

        if (confirmation === 'Yes, Clear All Data') {
            // Backup current data before clearing
            const backupPath = this.storagePath + '.backup.' + Date.now();
            try {
                fs.copyFileSync(this.storagePath, backupPath);
                vscode.window.showInformationMessage(`Backup saved to ${backupPath}`);
            } catch (error) {
                console.warn('Failed to create backup:', error);
            }

            this.data = {
                projects: [],
                version: '1.0.0',
                lastUpdated: new Date().toISOString()
            };
            this.saveData();
            vscode.window.showInformationMessage('All project data cleared');
        }
    }

    public getStoragePath(): string {
        return this.storagePath;
    }

    public async getRecentActivity(days: number = 7): Promise<{ project: string; commits: CommitData[] }[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);
        
        return this.getCommitsInDateRange(since, new Date());
    }
}
