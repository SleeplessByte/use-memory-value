import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import localForage from 'localforage';

import {
  StoredMemoryValue,
  MemoryValue,
  useMemoryValue,
  useMutableMemoryValue,
  setLocalForageInstance,
} from './index';

interface State {
  foo: number;
  bar: string;
  baz?: boolean;
}

const INITIAL_STATE: State = {
  foo: 42,
  bar: 'yes',
};

// Create local forage instance which is under our control
const StorageInstance: LocalForage = localForage.createInstance({
  name: 'tests',
  storeName: 'tests',
});
setLocalForageInstance(StorageInstance);

const MY_STATE = new MemoryValue<State>(INITIAL_STATE);
const MY_STORED_STATE = new StoredMemoryValue<State>('my.stored.value');

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

function StoredState() {
  const [state, updateState] = useMutableMemoryValue(MY_STORED_STATE);
  const increment = () =>
    updateState((prev) =>
      prev ? { ...prev, foo: prev.foo + 1 } : INITIAL_STATE
    );

  return (
    <button type="button" onClick={increment}>
      Foo: {state?.foo || 0}
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
beforeEach((done) => {
  MY_STATE.emit(INITIAL_STATE);
  StorageInstance.clear().finally(done);
});

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

test('it can store to local storage', async () => {
  const screen = render(<StoredState />);
  expect(MY_STORED_STATE.current).toBe(null);
  const stored = await StorageInstance.getItem('my.stored.value');
  expect(stored).toBeFalsy();

  // First test regular update for memory
  fireEvent.click(screen.getAllByRole('button')[0]);
  expect(MY_STORED_STATE.current).toStrictEqual(INITIAL_STATE);

  // Now see if that was persisted
  const newlyStored = await StorageInstance.getItem('my.stored.value');
  expect(newlyStored).toStrictEqual(INITIAL_STATE);
});

test('it can read from local storage', async () => {
  const injectedState: State = {
    foo: 99,
    bar: 'problems',
  };

  await StorageInstance.setItem('my.tested.value', injectedState);
  const TestState = new StoredMemoryValue('my.tested.value');

  // It will be read on the next tick
  if (TestState.current) {
    return expect(TestState.current).toStrictEqual(injectedState);
  }

  return new Promise((resolve) =>
    TestState.subscribe((next) => {
      expect(next).toStrictEqual(injectedState);
      resolve();
    })
  );
});
