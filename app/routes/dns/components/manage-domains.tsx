import { closestCorners, DndContext, DragOverlay } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Form } from "react-router";

import Button from "~/components/button";
import Input from "~/components/Input";
import TableList from "~/components/TableList";
import cn from "~/utils/cn";

interface Props {
  searchDomains: string[];
  isDisabled: boolean;
  magic?: string;
}

export default function ManageDomains({ searchDomains, isDisabled, magic }: Props) {
  const [activeId, setActiveId] = useState<number | string | null>(null);
  const [localDomains, setLocalDomains] = useState(searchDomains);

  useEffect(() => {
    setLocalDomains(searchDomains);
  }, [searchDomains]);

  return (
    <div className="flex w-full flex-col sm:w-2/3">
      <h1 className="mb-4 text-2xl font-medium">Search Domains</h1>
      <p className="mb-4">
        Set custom DNS search domains for your Tailnet. When using Magic DNS, your tailnet domain is
        used as the first search domain.
      </p>
      <DndContext
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={(event) => {
          setActiveId(null);
          const { active, over } = event;
          if (!over) {
            return;
          }

          const activeItem = localDomains[(active.id as number) - 1];
          const overItem = localDomains[(over.id as number) - 1];

          if (!activeItem || !overItem) {
            return;
          }

          const oldIndex = localDomains.indexOf(activeItem);
          const newIndex = localDomains.indexOf(overItem);

          if (oldIndex !== newIndex) {
            setLocalDomains(arrayMove(localDomains, oldIndex, newIndex));
          }
        }}
        onDragStart={(event) => {
          setActiveId(event.active.id);
        }}
      >
        <TableList>
          {magic ? (
            <TableList.Item key="magic-dns-sd">
              <div
                className={cn(
                  "flex items-center gap-4",
                  isDisabled ? "flex-row-reverse justify-between w-full" : "",
                )}
              >
                <Lock className="p-0.5" />
                <p className="py-0.5 font-mono text-sm">{magic}</p>
              </div>
            </TableList.Item>
          ) : undefined}
          <SortableContext items={localDomains} strategy={verticalListSortingStrategy}>
            {localDomains.map((sd, index) => (
              <Domain domain={sd} id={index + 1} isDisabled={isDisabled} key={sd} />
            ))}
            <DragOverlay adjustScale>
              {activeId ? (
                <Domain
                  domain={localDomains[(activeId as number) - 1]}
                  id={(activeId as number) - 1}
                  isDisabled={isDisabled}
                  isDragging
                />
              ) : undefined}
            </DragOverlay>
          </SortableContext>
          {isDisabled ? undefined : (
            <TableList.Item key="add-sd">
              <Form className="flex w-full items-center justify-between" method="POST">
                <input name="action_id" type="hidden" value="add_domain" />
                <Input
                  className={cn(
                    "border-none font-mono p-0 text-sm",
                    "rounded-none focus:ring-0 w-full ml-1",
                  )}
                  isRequired
                  label="Search Domain"
                  labelHidden
                  name="domain"
                  placeholder="Search Domain"
                  type="text"
                />
                <Button
                  className={cn("px-2 py-1 rounded-md", "text-blue-500 dark:text-blue-400")}
                  type="submit"
                >
                  Add
                </Button>
              </Form>
            </TableList.Item>
          )}
        </TableList>
      </DndContext>
    </div>
  );
}

interface DomainProps {
  domain: string;
  id: number;
  isDragging?: boolean;
  isDisabled: boolean;
}

function Domain({ domain, id, isDragging, isDisabled }: DomainProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id });

  return (
    <TableList.Item
      className={cn(
        isSortableDragging ? "opacity-50" : "",
        isDragging ? "ring-3 bg-white dark:bg-mist-900" : "",
      )}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <p className="flex items-center gap-4 font-mono text-sm">
        {isDisabled ? undefined : (
          <GripVertical
            {...attributes}
            {...listeners}
            className="rounded-md p-0.5 outline-hidden focus:ring-3"
          />
        )}
        {domain}
      </p>
      {isDragging ? undefined : (
        <Form method="POST">
          <input name="action_id" type="hidden" value="remove_domain" />
          <input name="domain" type="hidden" value={domain} />
          <Button
            className={cn("px-2 py-1 rounded-md", "text-red-500 dark:text-red-400")}
            disabled={isDisabled}
            type="submit"
          >
            Remove
          </Button>
        </Form>
      )}
    </TableList.Item>
  );
}
