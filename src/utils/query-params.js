// Parameters are untrusted display context, not authorization or validated booking input.
export function readSelection(names, search = window.location.search) {
  const parameters = new URLSearchParams(search);
  return Object.fromEntries(names.map((name) => [name, parameters.get(name)]));
}
