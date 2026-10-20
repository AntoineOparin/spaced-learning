import { Link, useNavigate } from 'react-router';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { EmptyState, surface } from '../../ui/misc';
import { MaturityBar, MaturityLegend } from './charts';
import type { DashboardView } from './derive';

function CourseTile({ course, counts, maturity: m }: DashboardView['courses'][number]) {
  const navigate = useNavigate();
  const parts = [
    counts.learning && `${counts.learning} learning`,
    counts.review && `${counts.review} due`,
    counts.new && `${counts.new} new`,
  ].filter(Boolean);
  return (
    <li className={cn(surface, 'p-4 transition-colors hover:border-line-strong sm:p-5')}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Link
            to={`/library?course=${course.id}`}
            className="block truncate text-base font-bold decoration-line-strong decoration-2 underline-offset-4 hover:underline"
          >
            {course.name}
          </Link>
          <p className="mt-0.5 text-[13px] text-muted">
            {parts.length ? parts.join(' · ') : 'Nothing left today'}
          </p>
        </div>
        {parts.length ? (
          <Button size="sm" onClick={() => navigate(`/study?course=${course.id}`)}>
            Study
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-sm font-bold text-accent-text">
            <Icon name="check" size={18} /> Done
          </span>
        )}
      </div>
      <div className="mt-4">
        <MaturityBar m={m} />
      </div>
    </li>
  );
}

export function CourseList({ courses }: { courses: DashboardView['courses'] }) {
  return (
    <section aria-labelledby="courses-heading">
      <h2 id="courses-heading" className="mb-3 text-xl font-bold">
        Courses
      </h2>
      {courses.length ? (
        <>
          <ul className="space-y-3">
            {courses.map((c) => (
              <CourseTile key={c.course.id} {...c} />
            ))}
          </ul>
          <MaturityLegend />
        </>
      ) : (
        <EmptyState title="No active courses" icon="folder">
          Archived courses live in the Library.
        </EmptyState>
      )}
    </section>
  );
}
