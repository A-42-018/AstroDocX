// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)
// Every wait here reads the whole app over the 20k-reading demo seed in fake IndexedDB; with test files
// running in parallel, a database reload or a lazy route can take longer than the 1 s default.
configure({ asyncUtilTimeout: 15_000 })

it('boots the demo mission, shows the board for the first crew member and switches crew', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
  expect(screen.getByRole('status').textContent).toContain('Initializing')
  const list = await screen.findByRole('list', { name: 'Hazard status' }, { timeout: 120_000 })
  expect(list.querySelectorAll('li')).toHaveLength(5)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Commander')

  fireEvent.click(await screen.findByRole('button', { name: /^Flight Engineer/ }))
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Flight Engineer'))
  expect(screen.getByLabelText(/^Gravity: ACT/)).toBeTruthy()
}, 150_000)
