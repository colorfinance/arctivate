import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/train',
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import Nav from '../components/Nav'

describe('Nav', () => {
  it('renders all navigation links', () => {
    render(<Nav />)
    expect(screen.getByText('Train')).toBeInTheDocument()
    expect(screen.getByText('Coach')).toBeInTheDocument()
    expect(screen.getByText('Feed')).toBeInTheDocument()
    expect(screen.getByText('Habits')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
  })

  it('links to correct pages', () => {
    render(<Nav />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map(link => link.getAttribute('href'))
    expect(hrefs).toContain('/train')
    expect(hrefs).toContain('/coach')
    expect(hrefs).toContain('/feed')
    expect(hrefs).toContain('/habits')
    expect(hrefs).toContain('/food')
  })

  it('highlights the active page', () => {
    render(<Nav />)
    const trainLink = screen.getByText('Train').closest('a')
    expect(trainLink.className).toContain('text-arc-accent')
  })
})
