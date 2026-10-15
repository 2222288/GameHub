import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import { useAuth } from '@/stores/auth';
import { GameForm } from '@/components/admin/GameForm';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { ResourceEditor } from '@/components/admin/ResourceEditor';
import { Artwork } from '@/components/Artwork';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
export default function AdminGameEditorPage() {
  const { id } = useParams();
  const parsedId = id ? Number(id) : null;
  const gameId =
    parsedId !== null && Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const invalidId = Boolean(id) && gameId === null;
  const token = useAuth((state) => state.token);
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [analyzingCover, setAnalyzingCover] = useState(false);
  const editor = useQuery({
    queryKey: ['admin', 'editor', token, gameId],
    enabled: !invalidId,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const [categories, tags, game, links] = await Promise.all([
        adminApi.categories({ signal }),
        adminApi.tags('', { signal }),
        gameId ? adminApi.game(gameId, { signal }) : Promise.resolve(undefined),
        gameId ? adminApi.gameLinks(gameId, { signal }) : Promise.resolve([]),
      ]);
      return { categories, tags, game, links };
    },
  });
  const reload = () => {
    void editor.refetch();
  };
  const submit = async (data: unknown) => {
    setMessage('');
    if (gameId) {
      await adminApi.updateGame(gameId, data);
      await editor.refetch();
      setMessage('保存成功');
    } else {
      const game = await adminApi.createGame(data);
      navigate(`/admin/games/${game.id}/edit`, { replace: true });
    }
  };
  if (invalidId)
    return (
      <div role="alert" className="card p-6 text-err">
        无效的游戏 ID。
      </div>
    );
  if (editor.isPending) return <LoadingSkeleton count={4} />;
  if (editor.isError) return <ErrorState message={errorMessage(editor.error)} retry={reload} />;
  const { categories, tags, game, links } = editor.data;
  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black">{gameId ? '编辑游戏' : '新增游戏'}</h1>
        <p className="mt-2 text-sm text-ink-2">
          {gameId ? '管理基础信息、图片和资源链接。' : '填写基础信息，保存后即可添加图片和资源。'}
        </p>
      </div>
      {message && (
        <p role="status" className="mb-4 text-sm text-ok">
          {message}
        </p>
      )}
      <GameForm
        key={gameId ?? 'create'}
        game={game}
        categories={categories}
        tags={tags}
        onSubmit={submit}
      />
      {gameId && game && (
        <>
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold">图片管理</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <ImageUploader gameId={gameId} type="COVER" onUploaded={reload} />
              <ImageUploader gameId={gameId} type="BANNER" onUploaded={reload} />
              <ImageUploader gameId={gameId} type="SCREENSHOT" onUploaded={reload} />
            </div>
            {game.coverUrl && (
              <button
                type="button"
                className="btn btn-secondary mt-4"
                disabled={analyzingCover}
                onClick={async () => {
                  setAnalyzingCover(true);
                  setMessage('');
                  try {
                    await adminApi.reanalyzeCover(gameId);
                    await editor.refetch();
                    setMessage('封面色调分析完成');
                  } catch (error) {
                    setMessage(errorMessage(error, '无法分析当前封面；请重新上传 JPG/PNG 封面。'));
                  } finally {
                    setAnalyzingCover(false);
                  }
                }}
              >
                {analyzingCover ? '正在分析封面…' : '重新分析当前封面色调'}
              </button>
            )}
            {game.screenshots.length > 0 && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {game.screenshots.map((shot, index) => (
                  <div className="card overflow-hidden" key={shot.id}>
                    <div className="aspect-video">
                      <Artwork url={shot.url} name={`${game.name} 截图 ${index + 1}`} />
                    </div>
                    <div className="flex items-center justify-between p-3 text-sm">
                      <span className="text-ink-2">截图 #{index + 1}</span>
                      <button
                        className="text-err"
                        onClick={async () => {
                          if (!confirm('确定删除这张截图？')) return;
                          try {
                            await adminApi.deleteMedia(shot.id);
                            reload();
                          } catch (error) {
                            setMessage(errorMessage(error, '删除图片失败，请重试。'));
                          }
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <ResourceEditor gameId={gameId} items={links} onChanged={reload} />
        </>
      )}
    </div>
  );
}
