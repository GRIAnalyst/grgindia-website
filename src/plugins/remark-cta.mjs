import { visit } from 'unist-util-visit';

export function remarkCta() {
  return (tree) => {
    // Handle multi-line [CTA]...[/CTA] blocks
    // These span multiple paragraphs, so we need to find ranges
    const toRemove = new Set();

    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return;

      // Standalone [CTA] — single paragraph
      if (
        node.children.length === 1 &&
        node.children[0].type === 'text' &&
        node.children[0].value.trim() === '[CTA]'
      ) {
        parent.children[index] = {
          type: 'html',
          value: `<div class="cta-block">
  <p class="cta-headline">Ready to get started?</p>
  <p class="cta-sub">See how GRG India can transform your incentive programs.</p>
  <a href="/book-a-demo" class="cta-btn">Get Started</a>
</div>`,
        };
        return;
      }

      // Multi-line [CTA] opener with content on same or following lines
      const text = node.children.map((c) => c.value || '').join('');
      const multiMatch = text.match(/^\[CTA\]\s*([\s\S]*?)\[\/CTA\]$/);
      if (multiMatch) {
        const lines = multiMatch[1].trim().split('\n').map((l) => l.trim()).filter(Boolean);
        const headline = lines[0] || 'Ready to get started?';
        const sub = lines[1] || 'See how GRG India can transform your incentive programs.';
        parent.children[index] = {
          type: 'html',
          value: `<div class="cta-block">
  <p class="cta-headline">${headline}</p>
  <p class="cta-sub">${sub}</p>
  <a href="/book-a-demo" class="cta-btn">Get Started</a>
</div>`,
        };
      }
    });
  };
}
