// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

it('boots the demo mission, shows the board for the first crew member and switches crew', async () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
  expect(screen.getByRole('status').textContent).toContain('Initializing')
  const list = await screen.findByRole('list', { name: 'Hazard status' }, { timeout: 60_000 })
  expect(list.querySelectorAll('li')).toHaveLength(5)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Commander')

  fireEvent.click(screen.getByRole('tab', { name: 'Flight Engineer' }))
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Flight Engineer'))
  expect(screen.getByLabelText(/^Gravity: ACT/)).toBeTruthy()
}, 90_000)
