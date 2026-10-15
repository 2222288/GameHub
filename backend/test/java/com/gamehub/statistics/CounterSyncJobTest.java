package com.gamehub.statistics;

import com.gamehub.game.GameEventPublisher;
import com.gamehub.game.repository.GameRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CounterSyncJobTest {
    @Test void scansKeysAndRestoresPendingCountsWhenDatabaseWriteFails() {
        var redis=mock(StringRedisTemplate.class);var games=mock(GameRepository.class);var events=mock(GameEventPublisher.class);
        @SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
        @SuppressWarnings("unchecked") Cursor<String> views=mock(Cursor.class);
        @SuppressWarnings("unchecked") Cursor<String> clicks=mock(Cursor.class);
        when(redis.opsForValue()).thenReturn(values);when(redis.scan(any())).thenReturn(views,clicks);
        when(views.hasNext()).thenReturn(true,false);when(views.next()).thenReturn("game:view:pending:1");
        when(clicks.hasNext()).thenReturn(false);when(values.getAndDelete("game:view:pending:1")).thenReturn("5");
        when(games.update(isNull(),any())).thenThrow(new IllegalStateException("database unavailable"));
        assertDoesNotThrow(()->new CounterSyncJob(redis,games,events).sync());
        verify(values).increment("game:view:pending:1",5);verify(redis,never()).keys(anyString());verify(views).close();verify(clicks).close();
        verifyNoInteractions(events);
    }
}
