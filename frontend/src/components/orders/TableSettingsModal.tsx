import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export const TABLE_COLUMNS = [
  { id: 'documentDate',     label: 'Document Date' },
  { id: 'partner',          label: 'Partner' },
  { id: 'clientRef',        label: 'Reference Number' },
  { id: 'orderSeries',      label: 'Order Series' },
  { id: 'orderNumber',      label: 'Order Number' },
  { id: 'intermediary',     label: 'Intermediary Partner' },
  { id: 'vehicle',          label: 'Vehicle' },
  { id: 'driver',           label: 'Driver' },
  { id: 'pickup',           label: 'Pickup' },
  { id: 'pickupDate',       label: 'Pickup Date Begin' },
  { id: 'delivery',         label: 'Delivery' },
  { id: 'deliveryDate',     label: 'Delivery Date Begin' },
  { id: 'distance',         label: 'Distance' },
  { id: 'clientPrice',      label: 'Client Price' },
  { id: 'transporterPrice', label: 'Transporter Price' },
  { id: 'sent',             label: 'Sent' },
  { id: 'status',           label: 'Status' },
] as const;

export type ColumnId = typeof TABLE_COLUMNS[number]['id'];

export const ALL_COLUMN_IDS: ColumnId[] = TABLE_COLUMNS.map((c) => c.id);

export const STORAGE_KEY = 'tms-orders-table-columns';

// ─── Prefs shape ──────────────────────────────────────────────────────────────

export interface ColumnPrefs {
  visible: ColumnId[];
  order: ColumnId[];
}

export function loadColumnPrefs(): ColumnPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;

      // Legacy shape: plain array of visible column IDs (pre-reorder feature)
      if (Array.isArray(parsed)) {
        const visible = parsed.filter((v): v is ColumnId =>
          ALL_COLUMN_IDS.includes(v as ColumnId),
        );
        return {
          visible: visible.length > 0 ? visible : [...ALL_COLUMN_IDS],
          order: [...ALL_COLUMN_IDS],
        };
      }

      // Current shape: { visible: ColumnId[], order: ColumnId[] }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;

        const visible = Array.isArray(obj.visible)
          ? obj.visible.filter((v): v is ColumnId =>
              ALL_COLUMN_IDS.includes(v as ColumnId),
            )
          : [...ALL_COLUMN_IDS];

        let order: ColumnId[] = Array.isArray(obj.order)
          ? obj.order.filter((v): v is ColumnId =>
              ALL_COLUMN_IDS.includes(v as ColumnId),
            )
          : [...ALL_COLUMN_IDS];

        // Append columns added after the user last saved (handles schema additions)
        for (const id of ALL_COLUMN_IDS) {
          if (!order.includes(id)) order = [...order, id];
        }

        return {
          visible: visible.length > 0 ? visible : [...ALL_COLUMN_IDS],
          order,
        };
      }
    }
  } catch {
    // ignore parse errors — fall through to defaults
  }
  return { visible: [...ALL_COLUMN_IDS], order: [...ALL_COLUMN_IDS] };
}

export function saveColumnPrefs(prefs: ColumnPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

interface SortableColumnRowProps {
  id: ColumnId;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function SortableColumnRow({ id, label, checked, onToggle }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // Active item: Y-only cursor tracking, elevated with shadow (no X = no horizontal overflow).
  // Other items: Y-only transforms from verticalListSortingStrategy shuffle to show drop position.
  const style: React.CSSProperties = {
    transform: isDragging && transform
      ? `translateY(${transform.y}px)`
      : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    ...(isDragging ? {
      zIndex: 10,
      position: 'relative',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      background: 'white',
      borderRadius: '6px',
    } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/40 group"
    >
      <label className="flex items-center gap-2 cursor-pointer select-none text-sm flex-1 min-w-0">
        <Checkbox checked={checked} onCheckedChange={onToggle} />
        <span className="truncate">{label}</span>
      </label>
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity touch-none"
        aria-label={`Drag to reorder ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface TableSettingsModalProps {
  open: boolean;
  visibleColumns: ColumnId[];
  columnOrder: ColumnId[];
  onToggle: (id: ColumnId) => void;
  onReorder: (newOrder: ColumnId[]) => void;
  onReset: () => void;
  onClose: () => void;
}

export function TableSettingsModal({
  open,
  visibleColumns,
  columnOrder,
  onToggle,
  onReorder,
  onReset,
  onClose,
}: TableSettingsModalProps) {
  const sensors = useSensors(
    // Small distance prevents accidental drag when clicking a checkbox
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnOrder.indexOf(active.id as ColumnId);
    const newIndex = columnOrder.indexOf(over.id as ColumnId);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Table Columns</DialogTitle>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col py-1 max-h-[60vh] overflow-y-auto">
              {columnOrder.map((id) => {
                const col = TABLE_COLUMNS.find((c) => c.id === id);
                if (!col) return null;
                return (
                  <SortableColumnRow
                    key={id}
                    id={id}
                    label={col.label}
                    checked={visibleColumns.includes(id)}
                    onToggle={() => onToggle(id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset to default
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
