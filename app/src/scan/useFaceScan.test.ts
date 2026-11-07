import { describe, expect, it } from 'vitest'
import { cameraError } from './useFaceScan'

describe('cameraError', () => {
  it('says what to do for each way a camera can fail', () => {
    expect(cameraError(new DOMException('x', 'NotAllowedError'))).toMatch(/blocked/)
    expect(cameraError(new DOMException('x', 'NotFoundError'))).toMatch(/No camera/)
    expect(cameraError(new DOMException('x', 'NotReadableError'))).toMatch(/in use/)
    expect(cameraError(new Error('boom'))).toMatch(/could not be started/)
  })
})
