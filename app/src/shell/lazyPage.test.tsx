// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { lazyPage } from './lazyPage'

beforeEach(() => sessionStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const Page = () => <p>page ok</p>
const mount = (C: React.ComponentType) => render(<ErrorBoundary><Suspense fallback={<p>loading</p>}><C /></Suspense></ErrorBoundary>)

it('loads normally and clears any old reload guard', async () => {
  sessionStorage.setItem('astrodocx.chunk-reload', '1')
  mount(lazyPage(async () => ({ default: Page })))
  expect(await screen.findByText('page ok')).toBeTruthy()
  expect(sessionStorage.getItem('astrodocx.chunk-reload')).toBeNull()
})

it('reloads once when a chunk is missing after a redeploy', async () => {
  const reload = vi.fn()
  mount(lazyPage(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), reload))
  await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  expect(screen.getByText('loading')).toBeTruthy()
})

it('does not loop: after one reload the error reaches the error screen', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  sessionStorage.setItem('astrodocx.chunk-reload', '1')
  const reload = vi.fn()
  mount(lazyPage(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), reload))
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to fetch dynamically imported module')
  expect(reload).not.toHaveBeenCalled()
})
