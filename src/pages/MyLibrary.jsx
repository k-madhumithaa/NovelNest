import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Trash2, BookOpen, Clock, Loader2, BookmarkCheck, CheckCircle2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MyLibrary({ session }) {
  const [libraryBooks, setLibraryBooks] = useState([])
  const [inProgressBooks, setInProgressBooks] = useState([])
  const [finishedBooks, setFinishedBooks] = useState([]) // ✅ NEW: State for finished books
  const [progressMap, setProgressMap] = useState({}) 
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) fetchLibraryData()
  }, [session])

  async function fetchLibraryData() {
    // 1. Fetch "My Library" (Bookmarks)
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select('book_id, novels(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    
    // 2. Fetch "Reading Progress" for ALL books
    const { data: progress } = await supabase
      .from('reading_progress')
      .select('book_id, current_page, total_pages, novels(*)')
      .eq('user_id', session.user.id)

    // 3. Process Data
    if (bookmarks) {
        setLibraryBooks(bookmarks.map(b => b.novels))
    }

    if (progress) {
        // Create a lookup map: { 'book_id_123': { current: 10, total: 300 } }
        const pMap = {}
        progress.forEach(p => {
            pMap[p.book_id] = { current: p.current_page, total: p.total_pages }
        })
        setProgressMap(pMap)

        // Filter for books started (page > 1)
        const allStarted = progress
            .filter(p => p.current_page > 1)
            .map(p => ({ ...p.novels, current_page: p.current_page, total_pages: p.total_pages }))
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        
        // ✅ NEW LOGIC: Split into In-Progress vs Finished
        const inProgress = allStarted.filter(book => !book.total_pages || book.current_page < book.total_pages)
        const finished = allStarted.filter(book => book.total_pages > 0 && book.current_page >= book.total_pages)

        setInProgressBooks(inProgress)
        setFinishedBooks(finished)
    }
    
    setLoading(false)
  }

  async function removeFromLibrary(bookId) {
    if (!confirm("Remove from library?")) return
    const { error } = await supabase.from('bookmarks').delete().eq('user_id', session.user.id).eq('book_id', bookId)
    if (!error) {
      toast.success("Removed")
      setLibraryBooks(libraryBooks.filter(b => b.id !== bookId))
    }
  }

  if (loading) return <div className="p-20 text-center dark:text-white"><Loader2 className="animate-spin mx-auto"/></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* --- FEATURE 1: CONTINUE READING SHELF --- */}
        {inProgressBooks.length > 0 && (
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-800 dark:text-white mb-6 flex items-center">
              <Clock className="mr-3 text-purple-600" /> Continue Reading
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar">
              {inProgressBooks.map(book => (
                <Link key={book.id} to={`/book/${book.id}`} className="min-w-[200px] w-[200px] group">
                  <div className="relative rounded-xl overflow-hidden shadow-md h-[300px] mb-3">
                    <img src={book.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    {/* Progress Badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md p-3 border-t border-white/10">
                       <p className="text-white text-xs font-bold mb-1 flex justify-between">
                         <span>Page {book.current_page}</span>
                         {book.total_pages > 0 && <span className="text-gray-400">{Math.round((book.current_page / book.total_pages) * 100)}%</span>}
                       </p>
                       <div className="w-full bg-gray-700 rounded-full h-1.5">
                         <div 
                            className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${book.total_pages ? (book.current_page / book.total_pages) * 100 : 5}%` }}
                         ></div>
                       </div>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">{book.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* --- ✅ NEW: READ AGAIN SHELF (FINISHED BOOKS) --- */}
        {finishedBooks.length > 0 && (
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-800 dark:text-white mb-6 flex items-center">
              <RotateCcw className="mr-3 text-green-500" /> Read Again
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar">
              {finishedBooks.map(book => (
                <Link key={book.id} to={`/book/${book.id}`} className="min-w-[200px] w-[200px] group">
                  <div className="relative rounded-xl overflow-hidden shadow-md h-[300px] mb-3 border border-gray-200 dark:border-gray-700">
                    <img src={book.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-90" />
                    
                    {/* Tick Mark in the Corner */}
                    <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-1 shadow-lg z-10 backdrop-blur-sm border border-green-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>

                    {/* Completed Badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-green-900/90 backdrop-blur-md p-3 border-t border-green-500/30 text-center">
                       <p className="text-green-300 text-xs font-bold tracking-widest uppercase">Completed</p>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">{book.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* --- MY LIBRARY GRID --- */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-800 dark:text-white mb-8 flex items-center">
            <BookmarkCheck className="mr-3 text-purple-600" /> My Library
          </h1>

          {libraryBooks.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 mb-6">Your library is empty.</p>
              <Link to="/" className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold">Browse Books</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryBooks.map(book => {
                const progress = progressMap[book.id]
                const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
                
                return (
                  <div key={book.id} className="flex bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition border dark:border-gray-700 group">
                    <div className="w-1/3 min-w-[100px] relative">
                        <img src={book.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    </div>
                    
                    <div className="p-5 flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 leading-tight">{book.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{book.author}</p>
                        
                        {/* PROGRESS SECTION IN LIBRARY CARD */}
                        {progress ? (
                            <div className="mt-4">
                                <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    <span>Pg {progress.current} {progress.total > 0 ? `/ ${progress.total}` : ''}</span>
                                    {progress.total > 0 && <span>{percent}%</span>}
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className={`${percent >= 100 ? 'bg-green-500' : 'bg-purple-500'} h-1.5 rounded-full`} 
                                        style={{ width: `${percent > 0 ? percent : 5}%` }}
                                    ></div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 text-xs text-gray-400 italic">Not started yet</div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        <Link to={`/book/${book.id}`} className="flex-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-center py-2 rounded-lg text-sm font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition">
                            {progress ? (percent >= 100 ? 'Read Again' : 'Resume') : 'Read'}
                        </Link>
                        <button onClick={() => removeFromLibrary(book.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                            <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
