import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog, lessons } from '../content/courses.ts';

const slugs = ['expression', 'boundaries', 'differences', 'awkwardness', 'repair', 'together', 'rituals'];
const titles = ['从猜测到表达', '边界不等于疏远', '需要不同时', '把尴尬说小一点', '修复一次没说好的话', '十分钟双人练习', '建立你们的亲密语言'];
const summaryKeys = ['duration', 'goal', 'number', 'slug', 'subtitle', 'title'];

test('the seven ordered lessons match the promised course catalog', () => {
  assert.equal(lessons.length, 7);
  assert.deepEqual(lessons.map(lesson => lesson.slug), slugs);
  assert.deepEqual(lessons.map(lesson => lesson.title), titles);
  assert.deepEqual(lessons.map(lesson => lesson.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(lessons.map(lesson => lesson.goal)).size, 7);
  assert.equal(new Set(lessons.map(lesson => lesson.rewrite.template)).size, 7);
  assert.equal(new Set(lessons.map(lesson => lesson.scenario.setting)).size, 7);
});

test('public summaries expose no lesson body, answers, cards, or source material', () => {
  assert.equal(catalog.length, 7);
  for (const [index, summary] of catalog.entries()) {
    assert.deepEqual(Object.keys(summary).sort(), summaryKeys);
    assert.notStrictEqual(summary, lessons[index]);
    for (const key of summaryKeys) assert.equal(summary[key], lessons[index][key]);
  }
});

for (const lesson of lessons) {
  test(`${lesson.slug}: complete learning, practice, explanation and take-away material`, () => {
    assert.ok(lesson.duration >= 6 && lesson.duration <= 10);
    assert.equal(lesson.reviewStatus, 'draft');
    assert.ok(lesson.learn.length >= 3);
    for (const step of lesson.learn) {
      assert.ok(step.title.trim());
      assert.ok(step.body.length >= 65, 'a learning step must explain the method, not just name it');
      assert.ok(step.example.length >= 12, 'each step needs an usable example');
    }
    assert.ok(lesson.scenario.setting && lesson.scenario.prompt);
    assert.ok(lesson.scenario.options.length >= 3);
    assert.equal(new Set(lesson.scenario.options.map(option => option.feedback)).size, lesson.scenario.options.length);
    for (const option of lesson.scenario.options) {
      assert.ok(option.text.trim());
      assert.ok(option.feedback.length >= 40, 'feedback must explain the choice, not assign a bare score');
    }
    assert.ok(lesson.rewrite.prompt && lesson.rewrite.template);
    assert.equal(lesson.rewrite.checks.length, 3);
    assert.equal(new Set(lesson.rewrite.checks).size, 3);
    assert.ok(lesson.quiz.length >= 2);
    for (const question of lesson.quiz) {
      assert.ok(question.question.trim());
      assert.ok(question.options.length >= 3);
      assert.equal(new Set(question.options).size, question.options.length);
      assert.ok(Number.isInteger(question.correct));
      assert.ok(question.correct >= 0 && question.correct < question.options.length);
      assert.ok(question.explanation.length >= 30);
    }
    assert.ok(lesson.practice.title && lesson.practice.body.length >= 60);
    assert.ok(lesson.card.length >= 7);
    assert.ok(lesson.card.some(line => line.includes('尚未经独立专业人士审阅')));
    assert.ok(lesson.card.some(line => line.includes('威胁、控制或伤害不是你的措辞造成的')));
    assert.ok(lesson.sources.length >= 1);
    for (const source of lesson.sources) {
      assert.ok(source.title.trim());
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(['www.gottman.com', 'www.loveisrespect.org'].includes(url.hostname));
    }
  });
}

test('lesson methods and substantive content do not repeat across the collection', () => {
  for (const select of [lesson => lesson.learn.map(step => step.body), lesson => lesson.quiz.map(question => question.question), lesson => lesson.scenario.options.map(option => option.feedback)]) {
    const content = lessons.flatMap(select);
    assert.equal(new Set(content).size, content.length);
  }
});
