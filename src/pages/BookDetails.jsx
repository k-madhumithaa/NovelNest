import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PDFReader from '../components/PDFReader'
import { 
  Bookmark, BookmarkCheck, Share2, Star, BookOpen, Heart, 
  Loader2, Flag, MessageSquare, X, MoreHorizontal, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function BookDetails({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // --- STATE: BOOK & USER ---
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isBookmarked, setIsBookmarked] = useState(false)
  
  // --- STATE: PDF READER ---
  const [reading, setReading] = useState(false)
  const [savedPage, setSavedPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0) // ✅ NEW: Track total pages

  // --- STATE: RECOMMENDATIONS & SERIES ---
  const [relatedBooks, setRelatedBooks] = useState([]) 
  const [seriesBooks, setSeriesBooks] = useState([])

  // --- STATE: REVIEWS (Comments) ---
  const [reviews, setReviews] = useState([])
  const [reviewPage, setReviewPage] = useState(0)
  const [hasMoreReviews, setHasMoreReviews] = useState(true)
  const [likedReviews, setLikedReviews] = useState(new Set())
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState(new Set()) 

  // --- STATE: POSTING & REPLYING ---
  const [newComment, setNewComment] = useState('')
  const [newRating, setNewRating] = useState(5)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null) 
  const commentInputRef = useRef(null)

  const REVIEWS_PER_PAGE = 20 

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchBookData()
  }, [id, session])

  async function fetchBookData() {
    setLoading(true)
    const { data: bookData } = await supabase.from('novels').select('*').eq('id', id).single()
    setBook(bookData)

    if (bookData) {
      if (bookData.series_name) {
        const { data: sBooks } = await supabase.from('novels').select('id, title, cover_url, series_order, series_name').eq('series_name', bookData.series_name).neq('id', id).order('series_order', { ascending: true })
        setSeriesBooks(sBooks || [])
      }
      const { data: related } = await supabase.from('novels').select('id, title, cover_url, author').eq('genre', bookData.genre).neq('id', id).limit(4)                   
      setRelatedBooks(related || [])
    }
    
    fetchReviews(false)

    if (session?.user) {
      const { data: bm } = await supabase.from('bookmarks').select('*').eq('user_id', session.user.id).eq('book_id', id).maybeSingle()
      setIsBookmarked(!!bm)
      
      // ✅ Fetch both current AND total pages
      const { data: prog } = await supabase.from('reading_progress').select('current_page, total_pages').eq('user_id', session.user.id).eq('book_id', id).maybeSingle()
      if (prog) {
        setSavedPage(prog.current_page)
        setTotalPages(prog.total_pages || 0)
      }
    }
    setLoading(false)
  }

  async function fetchReviews(isLoadMore = false) {
    if (!isLoadMore) {
       setReviews([])
       setReviewPage(0)
    }
    setLoadingReviews(true)

    const from = (isLoadMore ? reviewPage : 0) * REVIEWS_PER_PAGE
    const to = from + REVIEWS_PER_PAGE - 1

    const { data } = await supabase
      .from('reviews')
      .select(`
        *, 
        profiles(nickname, full_name, avatar_url),
        review_likes(count)
      `)
      .eq('book_id', id)
      .order('created_at', { ascending: true }) 
      .range(from, to)

    if (data) {
      if (data.length < REVIEWS_PER_PAGE) setHasMoreReviews(false)
      else setHasMoreReviews(true)

      if (session) {
        const reviewIds = data.map(r => r.id)
        if (reviewIds.length > 0) {
          const { data: myLikes } = await supabase.from('review_likes').select('review_id').eq('user_id', session.user.id).in('review_id', reviewIds)
          const newLikedSet = new Set(isLoadMore ? likedReviews : [])
          myLikes?.forEach(l => newLikedSet.add(l.review_id))
          setLikedReviews(newLikedSet)
        }
      }
      setReviews(prev => isLoadMore ? [...prev, ...data] : data)
      if (isLoadMore) setReviewPage(prev => prev + 1)
      else setReviewPage(1)
    }
    setLoadingReviews(false)
  }

  // --- INTERACTION HANDLERS ---
  async function toggleReviewLike(reviewId) {
    if (!session) return toast.error("Login to like comments")
    const isLiked = likedReviews.has(reviewId)
    const newSet = new Set(likedReviews)
    if (isLiked) newSet.delete(reviewId)
    else newSet.add(reviewId)
    setLikedReviews(newSet)

    if (isLiked) await supabase.from('review_likes').delete().eq('user_id', session.user.id).eq('review_id', reviewId)
    else await supabase.from('review_likes').insert({ user_id: session.user.id, review_id: reviewId })
    
    const { data: counts } = await supabase.from('review_likes').select('review_id', { count: 'exact' }).eq('review_id', reviewId)
    setReviews(reviews.map(r => r.id === reviewId ? { ...r, review_likes: [{ count: counts?.length || (isLiked ? 0 : 1) }] } : r))
  }

  async function handleFlagReview(reviewId) {
    if (!session) return toast.error("Login to report")
    if (!confirm("Report this comment?")) return
    const { error } = await supabase.from('review_flags').insert({ user_id: session.user.id, review_id: reviewId })
    if (error && error.code === '23505') toast.error("Already reported.")
    else if (error) toast.error("Error reporting")
    else toast.success("Reported")
  }

  async function handleDeleteReview(reviewId) {
    if (!confirm("Delete this comment?")) return
    await supabase.from('reviews').delete().eq('id', reviewId)
    toast.success("Deleted")
    fetchReviews(false)
  }

  function handleReply(comment, rootId) {
    if (!session) return toast.error("Login to reply")
    const actualParentId = rootId || comment.id
    setReplyingTo({ ...comment, rootParentId: actualParentId })
    setNewComment(`@${comment.profiles?.nickname || 'User'} `)
    
    const newExpanded = new Set(expandedReplies)
    newExpanded.add(actualParentId)
    setExpandedReplies(newExpanded)

    commentInputRef.current?.focus()
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handlePostReview(e) {
    e.preventDefault()
    if (!session) return toast.error("Login to comment!")
    setSubmittingReview(true)
    
    const { error } = await supabase.from('reviews').insert({ 
      book_id: id, 
      user_id: session.user.id, 
      comment: newComment,
      rating: replyingTo ? null : newRating,
      parent_id: replyingTo ? replyingTo.rootParentId : null 
    })
    
    if (!error) { 
      setNewComment('')
      setReplyingTo(null)
      fetchReviews(false) 
    } else toast.error(error.message)
    
    setSubmittingReview(false)
  }

  async function toggleBookmark() {
     if (!session) return toast.error("Please login!")
     const newStatus = !isBookmarked
     setIsBookmarked(newStatus)
     if (newStatus) { 
       await supabase.from('bookmarks').insert({ user_id: session.user.id, book_id: book.id })
       toast.success("Added to Library") 
     } else { 
       await supabase.from('bookmarks').delete().eq('user_id', session.user.id).eq('book_id', book.id)
       toast.success("Removed from Library") 
     }
  }

  function handleShare() { 
    navigator.clipboard.writeText(window.location.href)
    toast.success("Link copied!") 
  }

  function formatInstaTime(dateString) {
    const diffInSeconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    return `${Math.floor(diffInDays / 7)}w`;
  }

  function toggleReplies(commentId) {
    const newSet = new Set(expandedReplies)
    if (newSet.has(commentId)) newSet.delete(commentId)
    else newSet.add(commentId)
    setExpandedReplies(newSet)
  }

  // ✅ NEW: Handle Read Button Click
  const isFinished = totalPages > 0 && savedPage >= totalPages;

  async function handleReadClick() {
    if (isFinished) {
      setSavedPage(1); // Reset to page 1
      if (session?.user) {
        await supabase.from('reading_progress').upsert({ 
          user_id: session.user.id, 
          book_id: book.id, 
          current_page: 1,
          total_pages: totalPages,
          last_read: new Date()
        }, { onConflict: 'user_id, book_id' })
      }
    }
    setReading(true);
  }

  // --- ORGANIZE COMMENTS ---
  const rootComments = reviews.filter(r => !r.parent_id)
  const getReplies = (parentId) => reviews.filter(r => r.parent_id === parentId)

  // --- REUSABLE COMMENT COMPONENT ---
  const CommentItem = ({ comment, isReply = false, rootId = null }) => {
    const displayName = comment.profiles?.nickname || comment.profiles?.full_name || 'Anonymous'
    const avatar = comment.profiles?.avatar_url
    const likeCount = comment.review_likes?.[0]?.count || 0 
    const isLiked = likedReviews.has(comment.id)
    const isOwner = session?.user?.id === comment.user_id

    return (
      <div className={`flex gap-3 group w-full ${isReply ? 'mt-3' : 'mb-5'}`}>
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
            <div className={`${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700`}>
              {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="avatar" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 text-xs">{displayName[0]}</div>}
            </div>
        </div>

        {/* Content */}
        <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
               <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{displayName}</span>
               {comment.rating && (
                  <div className="flex text-yellow-400">
                     {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < comment.rating ? "fill-current" : "text-gray-300 dark:text-gray-600"}`} />
                     ))}
                  </div>
               )}
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-300 leading-snug whitespace-pre-wrap">
                {comment.comment && comment.comment.includes('@') ? (
                    <span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{comment.comment.split(' ')[0]}</span> 
                        {comment.comment.substring(comment.comment.indexOf(' '))}
                    </span>
                ) : comment.comment}
            </p>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 font-medium">
                <span>{formatInstaTime(comment.created_at)}</span>
                {likeCount > 0 && <span>{likeCount} likes</span>}
                <button onClick={() => handleReply(comment, rootId || comment.id)} className="hover:text-gray-800 dark:hover:text-gray-300 transition">Reply</button>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => handleFlagReview(comment.id)} title="Report"><MoreHorizontal className="w-4 h-4 hover:text-red-500"/></button>
                  {isOwner && <button onClick={() => handleDeleteReview(comment.id)} title="Delete"><Trash2 className="w-3.5 h-3.5 hover:text-red-500"/></button>}
                </div>
            </div>
        </div>

        {/* Heart */}
        <div className="pt-2 pl-2">
            <button onClick={() => toggleReviewLike(comment.id)} className="focus:outline-none transform active:scale-125 transition">
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-gray-500'}`} />
            </button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="p-20 text-center dark:text-white flex justify-center"><Loader2 className="animate-spin"/></div>
  if (!book) return <div className="p-20 text-center dark:text-white">Book not found.</div>

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12 transition-colors">
      
      {reading && (
        <PDFReader 
          fileUrl={book.pdf_url} 
          bookId={book.id} 
          userId={session?.user?.id} 
          initialPage={savedPage} 
          onClose={() => { setReading(false); fetchBookData() }} 
        />
      )}

      {/* --- TOP SECTION: DETAILS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div className="relative group h-fit">
          <img src={book.cover_url} className="w-full rounded-lg shadow-2xl transition transform group-hover:scale-105 duration-500" alt={book.title} />
        </div>
        
        <div className="md:col-span-2 space-y-6 text-gray-900 dark:text-gray-100">
          <div>
            <span className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{book.genre}</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 font-serif leading-tight">{book.title}</h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 mt-2">{book.author}</p>
            {book.series_name && (
              <Link to={`/?search=${book.series_name}`} className="text-purple-600 dark:text-purple-400 font-semibold hover:underline block mt-1">{book.series_name} Series, Vol {book.series_order}</Link>
            )}
          </div>

          <div className="flex space-x-4 py-4 border-y dark:border-gray-700">
            {session ? (
              <button 
                onClick={handleReadClick} 
                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 transition shadow-lg flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5"/>
                {/* ✅ Read Again Logic Applied Here */}
                {isFinished ? 'Read Again' : (savedPage > 1 ? `Continue (Page ${savedPage})` : 'Start Reading')}
              </button>
            ) : (
              <Link to="/login" className="flex-1 bg-gray-900 dark:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-black text-center">Login to Read</Link>
            )}
            <button onClick={toggleBookmark} className={`p-3 rounded-lg border-2 transition ${isBookmarked ? 'bg-purple-100 dark:bg-purple-900 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-200' : 'border-gray-200 dark:border-gray-700 hover:border-purple-500'}`}>
              {isBookmarked ? <BookmarkCheck /> : <Bookmark />}
            </button>
            <button onClick={handleShare} className="p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"><Share2 /></button>
          </div>

          <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-2 border-b pb-2 border-gray-200 dark:border-gray-700">Synopsis</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{book.synopsis || book.description || "No synopsis available for this book."}</p>
          </div>
        </div>
      </div>

      {/* --- SERIES SHELF --- */}
      {book.series_name && seriesBooks.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-serif font-bold text-gray-800 dark:text-white mb-6">More in <span className="text-purple-600">{book.series_name}</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {seriesBooks.map(sBook => (
              <Link key={sBook.id} to={`/book/${sBook.id}`} className="group block">
                <div className="relative overflow-hidden rounded-lg shadow-md mb-2 aspect-[2/3]">
                  <img src={sBook.cover_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={sBook.title} />
                  <span className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">Vol {sBook.series_order}</span>
                </div>
                <h4 className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm">{sBook.title}</h4>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* --- RECOMMENDATIONS --- */}
      {relatedBooks.length > 0 && (
        <div className="mb-16">
          <h3 className="text-2xl font-bold mb-6 flex items-center dark:text-white">
            <BookOpen className="mr-2 text-purple-600" /> You May Also Like
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedBooks.map(rel => (
              <Link key={rel.id} to={`/book/${rel.id}`} className="group block">
                <div className="overflow-hidden rounded-lg shadow-md mb-3 aspect-[2/3]">
                  <img src={rel.cover_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={rel.title} />
                </div>
                <h4 className="font-bold text-gray-800 dark:text-gray-100 truncate">{rel.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{rel.author}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* --- COMMENTS SECTION --- */}
      <div className="max-w-3xl mx-auto border-t dark:border-gray-700 pt-12">
        {session ? (
          <form onSubmit={handlePostReview} className="mb-8 flex gap-3 items-start border-b dark:border-gray-700 pb-8">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 mt-1">
                 {session.user.email[0].toUpperCase()}
              </div>
              <div className="flex-1">
                  {replyingTo ? (
                    <div className="text-xs text-gray-500 mb-2 flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full w-fit">
                       <span>Replying to <span className="font-bold text-gray-900 dark:text-gray-200">@{replyingTo.profiles?.nickname || 'User'}</span></span>
                       <button type="button" onClick={() => {setReplyingTo(null); setNewComment('')}} className="ml-2 hover:text-red-500"><X className="w-3 h-3"/></button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 mb-2 ml-2">
                       {[1, 2, 3, 4, 5].map(star => (
                         <button type="button" key={star} onClick={() => setNewRating(star)} className="focus:outline-none">
                            <Star className={`w-4 h-4 transition ${star <= newRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}/>
                         </button>
                       ))}
                    </div>
                  )}
                  <div className="relative border border-gray-200 dark:border-gray-700 rounded-full flex items-center px-4 py-1 focus-within:border-gray-400 dark:focus-within:border-gray-500 transition">
                      <input 
                        ref={commentInputRef}
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)} 
                        className="w-full bg-transparent outline-none text-sm text-gray-800 dark:text-white py-2 placeholder-gray-400" 
                        placeholder={replyingTo ? "Add a reply..." : "Add a review..."}
                        required 
                        autoComplete="off"
                      />
                      <button disabled={submittingReview || !newComment.trim()} className="text-blue-500 font-bold text-sm ml-2 disabled:opacity-50 hover:text-blue-700 transition">
                        Post
                      </button>
                  </div>
              </div>
          </form>
        ) : (
          <div className="mb-8 pb-8 border-b dark:border-gray-700 text-center text-gray-500">
             <Link to="/login" className="font-bold text-blue-500 hover:underline">Log in</Link> to join the conversation.
          </div>
        )}

        <div className="space-y-1">
          {rootComments.length === 0 && <p className="text-gray-400 text-center py-10">No comments yet. Be the first to start the discussion!</p>}
          
          {rootComments.reverse().map((comment) => {
            const replies = getReplies(comment.id)
            const isExpanded = expandedReplies.has(comment.id)

            return (
              <div key={comment.id} className="w-full">
                <CommentItem comment={comment} />
                {replies.length > 0 && (
                  <div className="ml-[52px]">
                    {!isExpanded ? (
                      <button onClick={() => toggleReplies(comment.id)} className="flex items-center gap-3 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition mb-4">
                         <div className="w-6 border-b border-gray-400"></div>
                         View replies ({replies.length})
                      </button>
                    ) : (
                      <div className="space-y-1 mb-4 border-l-2 border-gray-100 dark:border-gray-800 pl-3 -ml-3">
                         {replies.map(reply => (
                            <CommentItem key={reply.id} comment={reply} isReply={true} rootId={comment.id} />
                         ))}
                         <button onClick={() => toggleReplies(comment.id)} className="flex items-center gap-3 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition mt-2 ml-3">
                           <div className="w-6 border-b border-gray-400"></div>
                           Hide replies
                         </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {hasMoreReviews && (
            <div className="mt-8 flex justify-center pb-10">
                <button onClick={() => fetchReviews(true)} disabled={loadingReviews} className="w-full py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex justify-center items-center gap-2">
                  {loadingReviews && <Loader2 className="w-4 h-4 animate-spin"/>}
                  Load more comments
                </button>
            </div>
        )}
      </div>
    </div>
  )
}
