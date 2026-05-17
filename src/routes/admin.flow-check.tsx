import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/flow-check')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/flow-check"!</div>
}
