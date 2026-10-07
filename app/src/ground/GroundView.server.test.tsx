// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GroundView } from './GroundView'
import { MISSION_START } from '../data/synthetic'

afterEach(cleanup)

it('reading from a server: names the source, hides the on-board count, offers refresh and reports errors', () => {
  const onRefresh = vi.fn()
  render(<GroundView now={MISSION_START} lastSyncedAt={null} pending={null} crew={[]} source="Supabase (abc.supabase.co), 0 rows" sourceError="Ground server answered 401" onRefresh={onRefresh} />)
  const head = screen.getByLabelText('Ground view status')
  expect(head.textContent).toContain('Source: Supabase (abc.supabase.co), 0 rows')
  expect(head.textContent).not.toContain('still on board')
  expect(screen.getByRole('alert').textContent).toContain('Could not reach the ground server (Ground server answered 401)')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh from server' }))
  expect(onRefresh).toHaveBeenCalled()
})
