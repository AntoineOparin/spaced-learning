import { useNavigate, useParams, useSearchParams } from 'react-router';
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
        title={id ? 'Edit item' : 'New item'}
        subtitle="Keep each item to one idea — atomic cards are faster to review and easier to remember."
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
