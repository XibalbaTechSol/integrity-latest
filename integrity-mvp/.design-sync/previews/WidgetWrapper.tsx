import { WidgetWrapper } from 'integrity-mvp';

const box = (node: React.ReactNode) => (
  <div style={{ width: '320px', height: '220px' }}>{node}</div>
);

export const Viewing = () =>
  box(
    <WidgetWrapper id="w1" isEditing={false} onDelete={() => {}}>
      <div style={{ color: 'var(--text-secondary)' }}>Widget content in view mode.</div>
    </WidgetWrapper>
  );

export const Editing = () =>
  box(
    <WidgetWrapper id="w2" isEditing={true} onDelete={() => {}}>
      <div style={{ color: 'var(--text-secondary)' }}>Widget content in edit mode — drag handle and menu visible.</div>
    </WidgetWrapper>
  );
