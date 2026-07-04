import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/types/ai.types';

function msg(content: string, role: 'user' | 'assistant' = 'assistant'): ChatMessageType {
  return { id: 'test-id', role, content, timestamp: new Date() };
}

describe('ChatMessage', () => {
  // ── Avatar fallbacks ───────────────────────────────────────────────────────

  it('shows "S" avatar fallback for assistant', () => {
    render(<ChatMessage message={msg('Hello')} />);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('shows "ME" avatar fallback for user', () => {
    render(<ChatMessage message={msg('Hello', 'user')} />);
    expect(screen.getByText('ME')).toBeInTheDocument();
  });

  // ── Plain text rendering ───────────────────────────────────────────────────

  it('renders plain text content', () => {
    render(<ChatMessage message={msg('Hello world')} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  // ── Inline markdown ────────────────────────────────────────────────────────

  it('renders **bold** as <strong>', () => {
    const { container } = render(<ChatMessage message={msg('**bold text**')} />);
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe('bold text');
  });

  it('renders *italic* as <em>', () => {
    const { container } = render(<ChatMessage message={msg('*italic text*')} />);
    const em = container.querySelector('em');
    expect(em).toBeInTheDocument();
    expect(em?.textContent).toBe('italic text');
  });

  it('renders `code` as <code>', () => {
    const { container } = render(<ChatMessage message={msg('`some code`')} />);
    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toBe('some code');
  });

  // ── Block rendering ────────────────────────────────────────────────────────

  it('renders unordered list items (- prefix)', () => {
    const { container } = render(<ChatMessage message={msg('- Item A\n- Item B')} />);
    const items = container.querySelectorAll('ul li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Item A');
    expect(items[1].textContent).toBe('Item B');
  });

  it('renders ordered list items (1. prefix)', () => {
    const { container } = render(<ChatMessage message={msg('1. First\n2. Second')} />);
    const ol = container.querySelector('ol');
    expect(ol).toBeInTheDocument();
    const items = ol!.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('First');
    expect(items[1].textContent).toBe('Second');
  });

  it('renders unordered list with * prefix', () => {
    const { container } = render(<ChatMessage message={msg('* One\n* Two')} />);
    const items = container.querySelectorAll('ul li');
    expect(items).toHaveLength(2);
  });

  it('renders mixed text and list content', () => {
    const content = 'Steps:\n- Do this\n- Do that';
    const { container } = render(<ChatMessage message={msg(content)} />);
    expect(screen.getByText('Steps:')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders bold text inside list item', () => {
    const { container } = render(<ChatMessage message={msg('- **Important** note')} />);
    const li = container.querySelector('li');
    const strong = li?.querySelector('strong');
    expect(strong?.textContent).toBe('Important');
  });

  it('renders empty-line separator between paragraphs', () => {
    const content = 'First paragraph\n\nSecond paragraph';
    render(<ChatMessage message={msg(content)} />);
    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph')).toBeInTheDocument();
  });
});
