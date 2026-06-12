import './reg'
import type { User } from './types'
import { Button } from './button'

export function App(props: { user: User }) {
  void props
  return <Button />
}
