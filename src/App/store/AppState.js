import { observable, computed, action, reaction, toJS } from 'mobx';
import { persist } from 'mobx-persist';
import _ from 'lodash';
import { TEXT_LOCATION, BACKGROUND_TYPE, DEFAULT_BG_COLOR } from '../constants';

const { ipcRenderer } = window.require('electron');

const SAMPLE_VERSES = [
  'In the beginning, God created the heavens and the earth.',
  'The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.',
  'And God said, "Let there be light," and there was light.',
  'And God saw that the light was good. And God separated the light from the darkness.',
  'God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.',
];

const list = (dict, sortKey = 'name') => _.sortBy(_.values(dict), sortKey);

const dict = (list, classType = null, key = 'name') => {
  return list.reduce((items, item) => {
    items[item[key]] = classType ? new classType(item) : item;
    return items;
  }, {});
};

const isVideo = _.memoize((ext) => ['mpeg4', 'mp4', 'webm'].includes(ext));

class Background {
  @persist
  @observable
  color = DEFAULT_BG_COLOR;

  @persist
  @observable
  file = '';

  @computed
  get type() {
    if (!this.file) {
      return BACKGROUND_TYPE.color;
    }
    const ext = this.file.split('.').pop();
    return isVideo(ext) ? BACKGROUND_TYPE.video : BACKGROUND_TYPE.image;
  }

  @action.bound
  setFile(file) {
    this.color = '';
    this.file = file;
  }

  @action.bound
  setColor(color) {
    this.color = color;
    this.file = '';
  }

  @action.bound
  update({ file, color }) {
    this.file = file;
    this.color = color;
  }
}

class Chapter {
  constructor({ name, fullPath }) {
    this.name = name;
    this.fullPath = fullPath;
  }

  @observable
  isSelected = false;

  @action.bound
  setIsSelected(isSelected) {
    this.isSelected = isSelected;
  }

  @action.bound
  toggleIsSelected() {
    this.isSelected = !this.isSelected;
  }
}

class Book {
  constructor({ name, chapters }) {
    this.name = name;
    this.chapterList = chapters.map((chapter) => new Chapter(chapter));
    this.chapters = dict(this.chapterList);
  }

  @observable
  chapters = {};

  @observable
  chapterList = [];

  @computed({ keepAlive: true })
  get selectedChapters() {
    return _.filter(this.chapterList, 'isSelected');
  }

  @computed({ keepAlive: true })
  get isSelected() {
    return _.some(this.chapterList, 'isSelected');
  }

  @computed({ keepAlive: true })
  get allSelected() {
    return _.every(this.chapterList, 'isSelected');
  }

  @action.bound
  toggleAllChapters() {
    const isSelected = this.allSelected;
    this.chapterList.forEach((chapter) => chapter.setIsSelected(!isSelected));
  }

  selectionToString() {
    return `${this.name}_${this.selectedChapters.map((chapter) => chapter.name).join('-')}`;
  }
}

class Project {
  constructor({ name, books }) {
    this.name = name;
    this.bookList = books.map((book) => new Book(book));
    this.books = dict(this.bookList);
    this.bookList.forEach((book) => {
      reaction(
        () => book.isSelected,
        (isSelected) => {
          this.updateBookSelection(book.name, isSelected);
        }
      );
    });
  }

  @observable
  books = {};

  @observable
  bookList = [];

  @observable
  bookSelection = [];

  @observable
  activeBookName = null;

  @computed({ keepAlive: true })
  get selectedBooks() {
    return _.filter(this.bookList, 'isSelected');
  }

  @computed({ keepAlive: true })
  get selectedChapterCount() {
    return _.reduce(
      this.selectedBooks,
      (count, book) => {
        count += book.selectedChapters.length;
        return count;
      },
      0
    );
  }

  @computed({ keepAlive: true })
  get activeBook() {
    return _.get(this.books, [this.activeBookName]);
  }

  @action.bound
  setActiveBook(bookName) {
    this.activeBookName = bookName;
  }

  @action.bound
  updateBookSelection(bookName, isSelected) {
    this.bookSelection.remove(bookName);
    if (isSelected) {
      this.bookSelection.push(bookName);
    }
  }

  selectionToJS() {
    return {
      name: this.name,
      books: this.selectedBooks.map((book) => ({
        name: book.name,
        chapters: book.selectedChapters.map((chapter) => ({
          name: chapter.name,
          fullPath: chapter.fullPath,
        })),
      })),
    };
  }
}

class ProjectList {
  constructor() {
    ipcRenderer.on('did-finish-getprojectstructure', (event, projects) => {
      this.setProjects(projects);
    });
  }

  @observable
  items = {};

  @observable
  activeProjectName = '';

  @computed({ keepAlive: true })
  get list() {
    return list(this.items);
  }

  @computed({ keepAlive: true })
  get activeProject() {
    return this.items[this.activeProjectName];
  }

  @computed({ keepAlive: true })
  get selectedChapters() {
    return this.activeProject.selectedBooks.reduce((acc, book) => {
      acc.concat(book.selectedChapters);
      return acc;
    }, []);
  }

  @computed({ keepAlive: true })
  get firstSelectedChapter() {
    return _.get(this, ['activeProject', 'selectedBooks', '0', 'selectedChapters', '0']);
  }

  @action.bound
  setProjects(projectList) {
    this.items = dict(projectList, Project);
    if (projectList.length === 1) {
      this.activeProjectName = projectList[0].name;
    } else if (!this.items[this.activeProjectName]) {
      this.activeProjectName = '';
    }
  }

  @action.bound
  setActiveProject(projectName = '') {
    this.activeProjectName = projectName;
    this.list.forEach((project) => project.setActiveBook(null));
  }
}

class Progress {
  constructor() {
    ipcRenderer.on('on-progress', (_, progress) => {
      this.setProgress(progress);
    });
    ipcRenderer.on('did-finish-conversion', (_, args) => {
      if (args.outputDirectory) {
        this.finish();
      } else {
        this.setError(args.error);
      }
    });
  }

  @observable
  percent = 0;

  @observable
  status = '';

  @observable
  error = null;

  @observable
  inProgress = false;

  @observable
  combined = false;

  @action.bound
  start(args) {
    console.log('Requesting processing', args);
    ipcRenderer.send('did-start-conversion', args);
    this.combined = args.combined;
    this.error = null;
    this.status = 'Getting things started...';
    this.percent = 0;
    this.inProgress = true;
  }

  @action.bound
  reset() {
    this.error = null;
    this.status = '';
    this.percent = 0;
    this.inProgress = false;
  }

  @action.bound
  finish() {
    this.error = null;
    this.status = '';
    this.percent = 0;
    this.inProgress = false;
  }

  @action.bound
  setProgress({ status, percent }) {
    this.status = status;
    this.percent = percent;
    this.inProgress = true;
  }

  @action.bound
  setError(error) {
    this.error = error;
  }
}

class AppState {
  constructor(root) {
    this.root = root;
    ipcRenderer.on('did-finish-getverses', (event, verses) => {
      if (Array.isArray(verses) && verses.length) {
        this.setVerses(verses);
      } else {
        console.error('Failed to set verses', verses);
      }
    });
    reaction(
      () => this.projects.firstSelectedChapter,
      (firstSelectedChapter) => {
        if (firstSelectedChapter) {
          ipcRenderer.send('did-start-getverses', {
            sourceDirectory: firstSelectedChapter.fullPath,
          });
        } else {
          this.setVerses(SAMPLE_VERSES);
        }
      }
    );
  }

  // Temporary migration function from old localStorage persistance.
  // See issue #76.
  migrateFromLocalStorage() {
    [
      { key: 'speechBubble', setter: this.setSpeechBubbleProps },
      { key: 'textLocation', setter: this.setTextLocation },
      { key: 'background', setter: this.background.update },
      { key: 'text', setter: this.setTextProps },
    ].forEach(({ key, setter }) => {
      if (localStorage[key]) {
        setter(JSON.parse(localStorage[key]));
        localStorage.removeItem(key);
      }
    });
  }

  @observable
  progress = new Progress();

  @observable
  projects = new ProjectList();

  @observable
  verses = SAMPLE_VERSES;

  @persist('object')
  @observable
  textLocation = {
    location: TEXT_LOCATION.center,
  };

  @persist('object', Background)
  @observable
  background = new Background();

  @persist('object')
  @observable
  text = {
    fontFamily: 'Arial',
    fontSize: 20,
    color: '#555',
    bold: false,
    italic: false,
    highlightColor: 'yellow',
    highlightRGB: 'rgba(255,255,0,1)',
  };

  @persist('object')
  @observable
  speechBubble = {
    color: '#FFF',
    rgba: 'rgba(255,255,255,1)',
    opacity: 1,
  };

  getVideoName() {
    // E.g
    // 'Mark_1.mp4'
    // 'Mark_1-2-3.mp4'
    // 'Mark_1-2_Luke_3.mp4'
    const videoType = 'mp4';
    const selection = this.projects.activeProject.selectedBooks
      .map((book) => {
        return book.selectionToString();
      })
      .join('_');
    return `${selection}.${videoType}`;
  }

  @action.bound
  setVerses(verses) {
    this.verses = verses;
  }

  @action.bound
  setTimingFile(file) {
    this.timingFile = file;
  }

  @action.bound
  setTextLocation(textLocationProps) {
    this.textLocation = { ...this.textLocation, ...textLocationProps };
  }

  @action.bound
  setTextProps(textProps) {
    this.text = { ...this.text, ...textProps };
  }

  @action.bound
  setSpeechBubbleProps(speechBubbleProps) {
    this.speechBubble = { ...this.speechBubble, ...speechBubbleProps };
  }

  @action.bound
  generateVideo(combined) {
    // TODO: Pass selected project structure to the CLI
    const project = this.projects.activeProject.selectionToJS();
    const sourceDirectory = _.get(this.projects, [
      'activeProject',
      'selectedBooks',
      '0',
      'selectedChapters',
      '0',
      'fullPath',
    ]);
    const args = {
      project,
      combined,
      sourceDirectory,
      textLocation: toJS(this.textLocation),
      background: _.pick(toJS(this.background), 'file', 'color', 'type'),
      text: toJS(this.text),
      speechBubble: toJS(this.speechBubble),
      output: this.getVideoName(),
      outputDirectory: toJS(this.root.settings.outputDirectory),
    };
    this.progress.start(args);
  }
}

export default AppState;
