// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { db } from '../data/db'

afterEach(cleanup)
configure({ asyncUtilTimeout: 15_000 })

it('examines the demo crew, answers a question, narrows to one member and logs the handoff', async () => {
  render(<MemoryRouter initialEntries={['/doctor']}><App /></MemoryRouter>)
  const findings = await screen.findByRole('region', { name: 'Findings' }, { timeout: 120_000 })
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(within(findings).getAllByText('Pilot: sleep last night').length).toBeGreaterThan(0)

  const said = screen.getByRole('log', { name: 'What VITA says' })
  expect(said.textContent).toMatch(/2 of 6 crew need attention/)

  // a suggested question is answered from the report (offline in tests: there is no /api/doctor)
  fireEvent.click(screen.getByRole('button', { name: 'Who needs attention first?' }))
  await waitFor(() => expect(said.textContent).toMatch(/In order: 1\. Pilot/))

  // one crew member, then the ground handoff style
  fireEvent.click(within(screen.getByRole('region', { name: 'Crew' })).getByRole('button', { name: /^Pilot/ }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Crew fitness' }).querySelectorAll('li')).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: /Ground handoff/ }))
  await waitFor(() => expect(said.textContent).toMatch(/^Situation: /))

  const before = await db.actionLog.count()
  fireEvent.click(screen.getByRole('button', { name: /Add to ground log/ }))
  await waitFor(async () => expect(await db.actionLog.count()).toBe(before + 1))
  const note = await db.actionLog.orderBy('id').last()
  expect(note).toMatchObject({ kind: 'note', crewId: 'pilot', sync: 'pending' })
  expect(note!.text).toMatch(/^VITA crew doctor \(Pilot\): Situation:/)
  // VITA is the page: the floating guide is not shown twice
  expect(screen.queryByRole('button', { name: /Ask VITA, the mission guide/ })).toBeNull()
}, 150_000)
