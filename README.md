# use-memory-value

Hooks for global state in memory and localstorage. It's like context, but only one state per value; allows you to subscribe and update values from far away.

## Installation

```bash
yarn add use-memory-value
```

It has the following peerDependencies, along with `react`:

```bash
yarn add localforage react-fast-compare
# assumes react is already installed
```

## Usage

Start by creating a new `MemoryValue` or `StoredMemoryValue`. You can declare this in any file, make sure it's exported and importable from all the files you want to use the value.

```typescript
import { MemoryValue } from 'use-memory-value';

interface State {
  foo: number;
  bar: string;
  baz?: boolean;
}

const INITIAL_STATE: State = {
  foo: 42,
  bar: 'yes',
};

export const MY_STATE = new MemoryValue<State>(INITIAL_STATE);
```

Then, where you want to use the value, import the `MemoryValue` and `useMemoryValue`:

```tsx
import { useMemoryValue, useMutableMemoryValue } from 'use-memory-value';

import { MY_STATE } from '../path/to/state';

function ReadOnlyBar() {
  const state = useMemoryValue(MY_STATE);
  return <h1>foo: {state && state.foo}</h1>;
}

function CountingFoo() {
  const [state, updateState] = useMutableMemoryValue(MY_STATE);
  const increment = () =>
    updateState((prev) => ({ ...prev, foo: prev.foo + 1 }));

  return (
    <button type="button" onClick={increment}>
      Foo: {state.foo}
    </button>
  );
}

function ActivateBaz() {
  const [, updateState] = useMutableMemoryValue(MY_STATE);
  const activate = () => updateState((prev) => ({ ...prev, baz: true }));

  return (
    <button type="button" onClick={activate}>
      Activate
    </button>
  );
}
```

If the value should be persisted to (and initialized from) local storage, use `StoredMemoryValue`:

```typescript
export const MY_STATE = new StoredMemoryValue<State>('local.key.name');
```
