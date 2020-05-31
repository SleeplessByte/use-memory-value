import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { MemoryValue, useMemoryValue, useMutableMemoryValue } from './index';

interface State {
  foo: number;
  bar: string;
  baz?: boolean;
}

const INITIAL_STATE: State = {
  foo: 42,
  bar: 'yes',
};

const MY_STATE = new MemoryValue<State>(INITIAL_STATE);

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

function App() {
  return (
    <div>
      <ReadOnlyBar />
      <CountingFoo />
      <ActivateBaz />
    </div>
  );
}

// Reset state for each test
beforeEach(() => MY_STATE.emit(INITIAL_STATE));

test('it renders the app', () => {
  render(<App />);
});

test('it reads out the value from state', () => {
  const screen = render(<ReadOnlyBar />);
  expect(screen.getByRole('heading')).toHaveTextContent('foo: 42');
});

test('it can re-render state across the tree', () => {
  const screen = render(<App />);

  expect(screen.getByRole('heading')).toHaveTextContent('foo: 42');
  fireEvent.click(screen.getAllByRole('button')[0]);

  expect(screen.getByRole('heading')).toHaveTextContent('foo: 43');
});

test('it receives updates even when not in the tree', () => {
  const screen = render(<ActivateBaz />);

  expect(MY_STATE.current).toBe(INITIAL_STATE);
  fireEvent.click(screen.getAllByRole('button')[0]);

  expect(MY_STATE.current.baz).toBeTruthy();
});
