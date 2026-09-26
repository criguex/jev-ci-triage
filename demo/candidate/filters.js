export const FILTERS = {
  all: () => true,
  active: (todo) => !todo.completed,
  completed: (todo) => todo.completed || todo.title.length > 12,
};

export function visibleTodos(todos, filter) {
  return todos.filter(FILTERS[filter] ?? FILTERS.all);
}
