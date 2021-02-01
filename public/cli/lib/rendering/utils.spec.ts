import test from 'ava';
import { chapterFormatToTimings } from './utils';
import { BKChapter } from '../../../models/projectFormat.model';

test('utils smoke test', (t) => {
  const chapter: BKChapter = {
    book: 'Genesis',
    chapter: '1',
    audio: {
      filename: 'audio.mp3',
      length: 92700,
    },
    segments: [
      {
        segmentId: 1,
        text: 'In the beginning God created the heavens and the earth.',
        verse: '1',
        startTime: 1040,
        length: 5300,
      },
      {
        segmentId: 2,
        text:
          'Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters.',
        verse: '2',
        startTime: 7040,
        length: 9300,
      },
    ],
  };
  const timings = chapterFormatToTimings(chapter);
  t.is(timings.length, 2);
});
