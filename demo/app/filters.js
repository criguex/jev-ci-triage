export const FILTERS = {
  all: () => true,
  active: (todo) => !todo.completed,
  completed: (todo) => todo.completed,
};

export function visibleTodos(todos, filter) {
  return todos.filter(FILTERS[filter] ?? FILTERS.all);
}
