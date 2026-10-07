// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

it('has a skip link to the main region, names each page in the title and moves focus on navigation', () => {
  render(<MemoryRouter initialEntries={['/board']}><App /></MemoryRouter>)
  const skip = screen.getByRole('link', { name: 'Skip to content' })
  expect(skip.getAttribute('href')).toBe('#main')
  const main = screen.getByRole('main')
  expect(main.id).toBe('main')
  expect(document.title).toBe('Status Board · AstroDocX Crew Console')
  expect(document.activeElement).not.toBe(main) // no focus jump on first load

  fireEvent.click(screen.getByRole('link', { name: 'Trends' }))
  expect(document.title).toBe('Trends · AstroDocX Crew Console')
  expect(document.activeElement).toBe(main)
  expect(screen.getByRole('link', { name: 'Trends' }).getAttribute('aria-current')).toBe('page')
})
