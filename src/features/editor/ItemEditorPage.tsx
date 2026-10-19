import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClass } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PageHeader } from '../../ui/misc';
import { ItemEditor } from './ItemEditor';

export default function ItemEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const topic = params.get('topic') ?? undefined;

  return (
    <div>
      <PageHeader
        back={
          <Link
            to={topic ? `/library?topic=${topic}` : '/library'}
            className={buttonClass('ghost', 'sm', '-ml-2 px-2 font-semibold')}
          >
            <Icon name="arrowLeft" size={18} /> Library
          </Link>
        }
        title={id ? 'Edit item' : 'New item'}
        subtitle="Keep each item to one idea — small cards are faster to review and easier to remember."
      />
      <ItemEditor
        key={id ?? 'new'}
        itemId={id}
        defaultTopicId={topic}
        onDone={(item, action) => {
          if (action === 'cancelled' && window.history.length > 1) navigate(-1);
          else navigate(item ? `/library?topic=${item.topicId}` : '/library');
        }}
      />
    </div>
  );
}
