import { contextBridge, ipcRenderer } from 'electron';
import { ProgressState } from '../main/models/progressState.model';
import { OpenDialogOptions, SaveDialogOptions } from '../src/App/components/file-dialog.model';
import { RootDirectories } from '../src/models/store.model';
import { SubmissionArgs, SubmissionReturn } from '../src/models/submission.model';

export const api = {
  /**
   * Here you can expose functions to the renderer process
   * so they can interact with the main (electron) side
   * without security problems.
   *
   * The functions below can accessed using `window.api.fnName`
   */

  getBKProject: (rootDirectories: RootDirectories): void => {
    ipcRenderer.send('did-start-getbkproject', rootDirectories);
  },

  onBKProject: (callback: Function): void => {
    ipcRenderer.on('did-finish-getbkproject', (_event: Event, projects: any) => {
      callback(projects);
    });
  },

  saveFile: (options: SaveDialogOptions): void => {
    ipcRenderer.send('did-start-file-save-dialog', options);
  },

  onFileSave: (callback: Function): void => {
    ipcRenderer.on('did-finish-file-save-dialog', (_event: Event, saveFilePath: string) => {
      callback(saveFilePath);
    });
  },

  openFile: (options: OpenDialogOptions): void => {
    ipcRenderer.send('did-start-file-open-dialog', options);
  },

  onFileOpen: (callback: Function): void => {
    ipcRenderer.on('did-finish-file-open-dialog', (_event: Event, openFilePaths: string) => {
      callback(openFilePaths);
    });
  },

  getFonts: (): void => {
    ipcRenderer.send('did-start-getfonts');
  },

  onGetFonts: (callback: Function): void => {
    ipcRenderer.on('did-finish-getfonts', (_event: Event, newFonts: string[] | Error) => {
      callback(newFonts);
    });
  },

  startConversion: (settings: SubmissionArgs) => {
    ipcRenderer.send('did-start-conversion', settings);
  },

  onProgress: (callback: Function): void => {
    ipcRenderer.on('on-progress', (_event: Event, progress: ProgressState) => {
      callback(progress);
    });
  },

  onConversionFinish: (callback: Function): void => {
    ipcRenderer.on('did-finish-conversion', (_event: Event, result: SubmissionReturn) => {
      callback(result);
    });
  },
};

contextBridge.exposeInMainWorld('api', api);
