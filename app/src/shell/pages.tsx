import { Navigate, Route } from 'react-router-dom'
import BoardPage from '../board/BoardPage'
import { lazyPage } from './lazyPage'

/*
 * The console's screens and their routes, shared by the console (App.tsx) and by the 3D cabin's wall screens (Embed.tsx),
 * so a screen in the cabin can open any page the console has.
 */

export const DoctorPage = lazyPage(() => import('../doctor/DoctorPage'))
export const AlertsPage = lazyPage(() => import('../alerts/AlertsPage'))
export const TrendsPage = lazyPage(() => import('../trends/TrendsPage'))
export const CheckInPage = lazyPage(() => import('../checkin/CheckInPage'))
export const SimulatorPage = lazyPage(() => import('../sim/SimulatorPage'))
export const SyncPage = lazyPage(() => import('../sync/SyncPage'))
export const GroundPage = lazyPage(() => import('../ground/GroundPage'))
export const NasaPage = lazyPage(() => import('../nasa/NasaPage'))
export const RfPage = lazyPage(() => import('../rf/RfPage'))
export const UltrasoundPage = lazyPage(() => import('../ultrasound/UltrasoundPage'))

/** Every screen but the board, for warming their chunks. */
export const LAZY_PAGES = [AlertsPage, TrendsPage, CheckInPage, SimulatorPage, SyncPage, GroundPage, NasaPage, RfPage, UltrasoundPage]

/** The console's routes, as an array of elements (React Router flattens it inside <Routes>); `fallback` is where an unknown path goes. */
export function pageRoutes(fallback = '/board') {
  return [
    <Route key="board" path="/board" element={<BoardPage />} />,
    <Route key="doctor" path="/doctor" element={<DoctorPage />} />,
    <Route key="alerts" path="/alerts" element={<AlertsPage />} />,
    <Route key="trends" path="/trends" element={<TrendsPage />} />,
    <Route key="checkin" path="/checkin" element={<CheckInPage />} />,
    <Route key="scan" path="/checkin/scan" element={<Navigate to="/checkin" replace />} />,
    <Route key="rf" path="/rf" element={<RfPage />} />,
    <Route key="ultrasound" path="/ultrasound" element={<UltrasoundPage />} />,
    <Route key="simulator" path="/simulator" element={<SimulatorPage />} />,
    <Route key="sync" path="/sync" element={<SyncPage />} />,
    <Route key="ground" path="/ground" element={<GroundPage />} />,
    <Route key="nasa" path="/nasa" element={<NasaPage />} />,
    <Route key="any" path="*" element={<Navigate to={fallback} replace />} />,
  ]
}
