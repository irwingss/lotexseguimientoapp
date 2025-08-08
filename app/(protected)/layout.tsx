import { Gatekeeper } from '@/components/auth/gatekeeper'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Gatekeeper>
      {children}
    </Gatekeeper>
  )
}
