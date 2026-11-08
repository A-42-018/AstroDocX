// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DoctorFigure } from './DoctorFigure'

afterEach(cleanup)

it('falls back to the particle drone where there is no WebGL (jsdom has none), so the stage is never empty', () => {
  const { container } = render(<DoctorFigure talking size={200} />)
  expect(container.querySelector('canvas.vita-avatar')).not.toBeNull()
  expect(container.querySelector('canvas.dr-doctor')).toBeNull()
})
