import { visibleTodos } from './filters.js';

const STORAGE_KEY = 'react-todos';
const $ = (selector) => document.querySelector(selector);

let todos = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

const filterFromHash = () => location.hash.replace('#/', '') || 'all';

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function renderCount() {
  const left = todos.filter((todo) => !todo.completed).length;
  $('.todo-count').innerHTML = `<strong>${left}</strong> ${left === 1 ? 'item' : 'items'} left`;
}

function scheduleCount() {
  setTimeout(renderCount, Math.floor(Math.random() * 300));
}

function item(todo) {
  const li = document.createElement('li');
  li.dataset.testid = 'todo-item';
  li.className = todo.completed ? 'completed' : '';
  li.innerHTML = `<div class="view"><input class="toggle" type="checkbox" aria-label="Toggle Todo"><label data-testid="todo-title"></label><button class="destroy" aria-label="Delete"></button></div>`;
  li.querySelector('label').textContent = todo.title;
  const toggle = li.querySelector('.toggle');
  toggle.checked = todo.completed;
  toggle.addEventListener('change', () => {
    todo.completed = toggle.checked;
    save();
    render({ deferCount: true });
  });
  li.querySelector('.destroy').addEventListener('click', () => {
    todos = todos.filter((other) => other !== todo);
    save();
    render();
  });
  return li;
}

function render({ deferCount = false } = {}) {
  const filter = filterFromHash();
  $('.todo-list').replaceChildren(...visibleTodos(todos, filter).map(item));
  $('.main').hidden = todos.length === 0;
  $('.footer').hidden = todos.length === 0;
  $('.toggle-all').checked = todos.length > 0 && todos.every((todo) => todo.completed);
  $('.clear-completed').hidden = !todos.some((todo) => todo.completed);
  document.querySelectorAll('.filters a').forEach((link) => {
    link.classList.toggle('selected', link.getAttribute('href') === `#/${filter === 'all' ? '' : filter}`);
  });
  if (deferCount) {
    scheduleCount();
  } else {
    renderCount();
  }
}

$('.new-todo').addEventListener('keydown', (event) => {
  const title = event.target.value.trim();
  if (event.key !== 'Enter' || !title) {
    return;
  }
  todos.push({ id: crypto.randomUUID(), title, completed: false });
  event.target.value = '';
  save();
  render();
});

$('.toggle-all').addEventListener('change', (event) => {
  todos.forEach((todo) => {
    todo.completed = event.target.checked;
  });
  save();
  render();
});

$('.clear-completed').addEventListener('click', () => {
  todos = todos.filter((todo) => !todo.completed);
  save();
  render();
});

window.addEventListener('hashchange', () => render());
render();
